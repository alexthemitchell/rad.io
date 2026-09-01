import type { TrackedSignal } from '../workers/protocol'
import {
  E4000_MAX_FREQUENCY_HZ,
  E4000_MIN_FREQUENCY_HZ,
  E4000_TUNER_GAINS_DB,
  RTL_SDR_DIRECT_SAMPLE_MAX_HZ,
  type RtlSdrConfig,
  type RtlSdrRuntimeCommand,
} from './rtlSdrProtocol'

const MINIMUM_TARGET_HITS = 6
const MINIMUM_TARGET_DURATION_US = 1_000_000n
const TARGET_MATCH_TOLERANCE_HZ = 50_000
const TARGET_MISSING_GRACE_MS = 2_000
const PREFERRED_IF_OFFSET_HZ = 250_000
const DC_GUARD_HZ = 120_000
const CAPTURE_EDGE_HEADROOM_HZ = 120_000
const RETUNE_DEADBAND_HZ = 25_000
const SETTLE_TIME_MS = 1_000
const OBSERVATION_COUNT = 4
const OVERLOAD_LEVEL_DBFS = -8
const OPERATING_LEVEL_LOW_DBFS = -18
const OPERATING_LEVEL_HIGH_DBFS = -10
const MINIMUM_PROBE_SNR_IMPROVEMENT_DB = 0.5
const INITIAL_MANUAL_GAIN_DB = 24

export type RtlSdrAutoOptimizeStatus =
  | 'off'
  | 'waiting-for-source'
  | 'waiting-for-signal'
  | 'retuning'
  | 'settling'
  | 'adjusting-gain'
  | 'optimized'
  | 'error'

export type RtlSdrAutoOptimizerInput = {
  enabled: boolean
  running: boolean
  nowMs: number
  config: RtlSdrConfig
  signals: readonly TrackedSignal[]
  selectedTargetFrequencyHz: number | null
  peakPowerDbfs: number
}

export type RtlSdrAutoOptimizerResult = {
  status: RtlSdrAutoOptimizeStatus
  targetFrequencyHz: number | null
  command: RtlSdrRuntimeCommand | null
  detail: string
}

type GainProbe = {
  previousGainDb: number
  baselineSnrDb: number
}

export class RtlSdrAutoOptimizer {
  #targetFrequencyHz: number | null = null
  #lastTargetSeenMs = 0
  #settleUntilMs = 0
  #inFlight: RtlSdrRuntimeCommand | null = null
  #observations: Array<{ peakPowerDbfs: number; snrDb: number }> = []
  #gainProbe: GainProbe | null = null
  #higherGainRejected = false
  #lastOptimizedDetail: string | null = null
  #error: string | null = null

  reset(): void {
    this.#targetFrequencyHz = null
    this.#lastTargetSeenMs = 0
    this.#settleUntilMs = 0
    this.#inFlight = null
    this.#observations = []
    this.#gainProbe = null
    this.#higherGainRejected = false
    this.#lastOptimizedDetail = null
    this.#error = null
  }

  commandApplied(command: RtlSdrRuntimeCommand, nowMs: number): void {
    if (!this.#inFlight || !sameCommand(this.#inFlight, command)) return
    this.#inFlight = null
    this.#observations = []
    this.#lastOptimizedDetail = null
    this.#settleUntilMs = nowMs + SETTLE_TIME_MS
  }

  commandFailed(message: string): void {
    this.#inFlight = null
    this.#observations = []
    this.#lastOptimizedDetail = null
    this.#error = message
  }

  update(input: RtlSdrAutoOptimizerInput): RtlSdrAutoOptimizerResult {
    if (!input.enabled) {
      this.reset()
      return this.#result('off', null, 'Automatic optimization is off.')
    }
    if (!input.running) {
      this.reset()
      return this.#result('waiting-for-source', null, 'Connect RTL-SDR to begin optimization.')
    }
    if (this.#error) return this.#result('error', null, this.#error)

    const target = this.#selectTarget(input)
    if (!target) {
      this.#observations = []
      return this.#result(
        'waiting-for-signal',
        null,
        input.selectedTargetFrequencyHz === null
          ? 'Waiting for a stable active signal.'
          : 'Waiting for the selected signal to become stable.',
      )
    }
    const targetFrequencyHz = signalFrequencyHz(target)
    if (
      this.#targetFrequencyHz === null ||
      Math.abs(this.#targetFrequencyHz - targetFrequencyHz) > TARGET_MATCH_TOLERANCE_HZ
    ) {
      this.#targetFrequencyHz = targetFrequencyHz
      this.#observations = []
      this.#gainProbe = null
      this.#higherGainRejected = false
      this.#lastOptimizedDetail = null
    }
    this.#lastTargetSeenMs = input.nowMs

    if (this.#inFlight) {
      return this.#result(
        this.#inFlight.type === 'set-center-frequency' ? 'retuning' : 'adjusting-gain',
        null,
        describeCommand(this.#inFlight),
      )
    }
    if (input.nowMs < this.#settleUntilMs) {
      return this.#result('settling', null, 'Waiting for fresh measurements.')
    }
    if (input.config.tunerGainDb === null) {
      return this.#issue(
        { type: 'set-tuner-gain', tunerGainDb: INITIAL_MANUAL_GAIN_DB },
        'adjusting-gain',
      )
    }

    const placement = preferredCenterFrequencyHz(target, input.config)
    if (!placement.supported) {
      this.#observations = []
      return this.#result(
        'waiting-for-signal',
        null,
        'The selected signal does not fit inside the current capture bandwidth.',
      )
    }
    if (
      placement.centerFrequencyHz !== null &&
      Math.abs(placement.centerFrequencyHz - input.config.centerFrequencyHz) > RETUNE_DEADBAND_HZ
    ) {
      return this.#issue(
        { type: 'set-center-frequency', centerFrequencyHz: placement.centerFrequencyHz },
        'retuning',
      )
    }

    this.#observations.push({ peakPowerDbfs: input.peakPowerDbfs, snrDb: target.snrDb })
    if (this.#observations.length < OBSERVATION_COUNT) {
      return this.#result(
        this.#lastOptimizedDetail ? 'optimized' : 'settling',
        null,
        this.#lastOptimizedDetail ?? 'Collecting stable level and SNR measurements.',
      )
    }
    const observations = this.#observations.splice(0)
    const peakPowerDbfs = median(observations.map((observation) => observation.peakPowerDbfs))
    const snrDb = median(observations.map((observation) => observation.snrDb))

    if (this.#gainProbe) {
      const probe = this.#gainProbe
      this.#gainProbe = null
      if (snrDb < probe.baselineSnrDb + MINIMUM_PROBE_SNR_IMPROVEMENT_DB) {
        this.#higherGainRejected = true
        return this.#issue(
          { type: 'set-tuner-gain', tunerGainDb: probe.previousGainDb },
          'adjusting-gain',
        )
      }
    }

    if (peakPowerDbfs > OVERLOAD_LEVEL_DBFS || peakPowerDbfs > OPERATING_LEVEL_HIGH_DBFS) {
      const lowerGain = adjacentGain(input.config.tunerGainDb, -1)
      if (lowerGain !== null) {
        return this.#issue({ type: 'set-tuner-gain', tunerGainDb: lowerGain }, 'adjusting-gain')
      }
    }
    if (peakPowerDbfs < OPERATING_LEVEL_LOW_DBFS && !this.#higherGainRejected) {
      const higherGain = adjacentGain(input.config.tunerGainDb, 1)
      if (higherGain !== null) {
        this.#gainProbe = {
          previousGainDb: input.config.tunerGainDb,
          baselineSnrDb: snrDb,
        }
        return this.#issue({ type: 'set-tuner-gain', tunerGainDb: higherGain }, 'adjusting-gain')
      }
    }

    this.#lastOptimizedDetail =
      `Target level ${peakPowerDbfs.toFixed(1)} dBFS, SNR ${snrDb.toFixed(1)} dB.`
    return this.#result('optimized', null, this.#lastOptimizedDetail)
  }

  #selectTarget(input: RtlSdrAutoOptimizerInput): TrackedSignal | null {
    const eligible = input.signals.filter(isEligibleTarget)
    if (input.selectedTargetFrequencyHz !== null) {
      return closestSignal(eligible, input.selectedTargetFrequencyHz)
    }
    if (this.#targetFrequencyHz !== null) {
      const retained = closestSignal(eligible, this.#targetFrequencyHz)
      if (retained) return retained
      if (input.nowMs - this.#lastTargetSeenMs <= TARGET_MISSING_GRACE_MS) return null
      this.#targetFrequencyHz = null
      this.#observations = []
      this.#gainProbe = null
      this.#higherGainRejected = false
      this.#lastOptimizedDetail = null
    }
    return [...eligible].sort(compareTargetPriority)[0] ?? null
  }

  #issue(
    command: RtlSdrRuntimeCommand,
    status: 'retuning' | 'adjusting-gain',
  ): RtlSdrAutoOptimizerResult {
    this.#inFlight = command
    this.#observations = []
    this.#lastOptimizedDetail = null
    return this.#result(status, command, describeCommand(command))
  }

  #result(
    status: RtlSdrAutoOptimizeStatus,
    command: RtlSdrRuntimeCommand | null,
    detail: string,
  ): RtlSdrAutoOptimizerResult {
    return { status, targetFrequencyHz: this.#targetFrequencyHz, command, detail }
  }
}

function isEligibleTarget(signal: TrackedSignal): boolean {
  return signal.state === 'active' &&
    signal.absoluteFrequencyHz !== null &&
    !signal.edgeClipped &&
    signal.hitCount >= MINIMUM_TARGET_HITS &&
    signal.durationUs >= MINIMUM_TARGET_DURATION_US
}

function signalFrequencyHz(signal: TrackedSignal): number {
  return Math.round(signal.classification.primary.channelCenterHz ?? signal.absoluteFrequencyHz!)
}

function closestSignal(
  signals: readonly TrackedSignal[],
  frequencyHz: number,
): TrackedSignal | null {
  return signals
    .map((signal) => ({ signal, differenceHz: Math.abs(signalFrequencyHz(signal) - frequencyHz) }))
    .filter(({ differenceHz }) => differenceHz <= TARGET_MATCH_TOLERANCE_HZ)
    .sort((left, right) => left.differenceHz - right.differenceHz)[0]?.signal ?? null
}

function compareTargetPriority(left: TrackedSignal, right: TrackedSignal): number {
  return right.snrDb - left.snrDb ||
    right.peakPowerDbfs - left.peakPowerDbfs ||
    right.classification.primary.score - left.classification.primary.score ||
    right.hitCount - left.hitCount ||
    left.id.localeCompare(right.id)
}

function preferredCenterFrequencyHz(
  signal: TrackedSignal,
  config: RtlSdrConfig,
): { supported: boolean; centerFrequencyHz: number | null } {
  const targetFrequencyHz = signalFrequencyHz(signal)
  const halfSignalWidthHz = Math.max(
    signal.bandwidthHz / 2,
    signal.lowerFrequencyHz === null ? 0 : targetFrequencyHz - signal.lowerFrequencyHz,
    signal.upperFrequencyHz === null ? 0 : signal.upperFrequencyHz - targetFrequencyHz,
  )
  const halfCaptureHz = config.sampleRateHz / 2
  if (halfSignalWidthHz + CAPTURE_EDGE_HEADROOM_HZ > halfCaptureHz) {
    return { supported: false, centerFrequencyHz: null }
  }
  const currentOffsetHz = targetFrequencyHz - config.centerFrequencyHz
  if (
    Math.abs(currentOffsetHz) >= DC_GUARD_HZ &&
    Math.abs(currentOffsetHz) + halfSignalWidthHz + CAPTURE_EDGE_HEADROOM_HZ <= halfCaptureHz
  ) return { supported: true, centerFrequencyHz: null }

  const candidates = [
    targetFrequencyHz - PREFERRED_IF_OFFSET_HZ,
    targetFrequencyHz + PREFERRED_IF_OFFSET_HZ,
  ].filter((centerFrequencyHz) =>
    isSupportedCenter(centerFrequencyHz) &&
    Math.abs(targetFrequencyHz - centerFrequencyHz) +
      halfSignalWidthHz +
      CAPTURE_EDGE_HEADROOM_HZ <= halfCaptureHz
  )
  candidates.sort((left, right) =>
    Math.abs(left - config.centerFrequencyHz) - Math.abs(right - config.centerFrequencyHz),
  )
  return { supported: candidates.length > 0, centerFrequencyHz: candidates[0] ?? null }
}

function isSupportedCenter(centerFrequencyHz: number): boolean {
  return centerFrequencyHz > 0 &&
    (centerFrequencyHz <= RTL_SDR_DIRECT_SAMPLE_MAX_HZ ||
      centerFrequencyHz >= E4000_MIN_FREQUENCY_HZ && centerFrequencyHz <= E4000_MAX_FREQUENCY_HZ)
}

function adjacentGain(currentGainDb: number, direction: -1 | 1): number | null {
  const index = (E4000_TUNER_GAINS_DB as readonly number[]).indexOf(currentGainDb)
  if (index < 0) return null
  return E4000_TUNER_GAINS_DB[index + direction] ?? null
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle]
}

function sameCommand(left: RtlSdrRuntimeCommand, right: RtlSdrRuntimeCommand): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function describeCommand(command: RtlSdrRuntimeCommand): string {
  if (command.type === 'set-center-frequency') {
    return `Retuning to ${(command.centerFrequencyHz / 1_000_000).toFixed(3)} MHz.`
  }
  if (command.type === 'set-tuner-gain') {
    return command.tunerGainDb === null
      ? 'Enabling tuner AGC.'
      : `Setting tuner gain to ${command.tunerGainDb} dB.`
  }
  return 'Applying receiver setting.'
}