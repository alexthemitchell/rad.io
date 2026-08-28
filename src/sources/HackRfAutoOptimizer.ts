import type { TrackedSignal } from '../workers/protocol'
import type { HackRfConfig, HackRfRuntimeCommand } from './hackrfProtocol'

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

export type HackRfAutoOptimizeStatus =
  | 'off'
  | 'waiting-for-source'
  | 'waiting-for-signal'
  | 'retuning'
  | 'settling'
  | 'adjusting-gain'
  | 'optimized'
  | 'error'

export type HackRfAutoOptimizerInput = {
  enabled: boolean
  running: boolean
  nowMs: number
  config: HackRfConfig
  signals: readonly TrackedSignal[]
  selectedTargetFrequencyHz: number | null
  peakPowerDbfs: number
}

export type HackRfAutoOptimizerResult = {
  status: HackRfAutoOptimizeStatus
  targetFrequencyHz: number | null
  command: HackRfRuntimeCommand | null
  detail: string
}

type Observation = {
  peakPowerDbfs: number
  snrDb: number
}

type LnaProbe = {
  previousGainDb: number
  candidateGainDb: number
  baselineSnrDb: number
}

export class HackRfAutoOptimizer {
  #targetFrequencyHz: number | null = null
  #lastTargetSeenMs = 0
  #settleUntilMs = 0
  #inFlight: HackRfRuntimeCommand | null = null
  #observations: Observation[] = []
  #lnaProbe: LnaProbe | null = null
  #lnaProbeRejected = false
  #lastOptimizedDetail: string | null = null
  #error: string | null = null

  reset(): void {
    this.#targetFrequencyHz = null
    this.#lastTargetSeenMs = 0
    this.#settleUntilMs = 0
    this.#inFlight = null
    this.#observations = []
    this.#lnaProbe = null
    this.#lnaProbeRejected = false
    this.#lastOptimizedDetail = null
    this.#error = null
  }

  commandApplied(command: HackRfRuntimeCommand, nowMs: number): void {
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

  update(input: HackRfAutoOptimizerInput): HackRfAutoOptimizerResult {
    if (!input.enabled) {
      this.reset()
      return this.#result('off', null, 'Automatic optimization is off.')
    }
    if (!input.running) {
      this.reset()
      return this.#result('waiting-for-source', null, 'Connect HackRF One to begin optimization.')
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
      this.#lnaProbe = null
      this.#lnaProbeRejected = false
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

    this.#observations.push({
      peakPowerDbfs: input.peakPowerDbfs,
      snrDb: target.snrDb,
    })
    if (this.#observations.length < OBSERVATION_COUNT) {
      if (this.#lastOptimizedDetail) {
        return this.#result('optimized', null, this.#lastOptimizedDetail)
      }
      return this.#result('settling', null, 'Collecting stable level and SNR measurements.')
    }
    const observations = this.#observations.splice(0)
    const peakPowerDbfs = median(observations.map((observation) => observation.peakPowerDbfs))
    const snrDb = median(observations.map((observation) => observation.snrDb))

    if (this.#lnaProbe) {
      const probe = this.#lnaProbe
      this.#lnaProbe = null
      if (snrDb < probe.baselineSnrDb + MINIMUM_PROBE_SNR_IMPROVEMENT_DB) {
        this.#lnaProbeRejected = true
        return this.#issue(
          { type: 'set-lna-gain', lnaGainDb: probe.previousGainDb },
          'adjusting-gain',
        )
      }
    }

    if (peakPowerDbfs > OVERLOAD_LEVEL_DBFS) {
      if (input.config.vgaGainDb > 0) {
        return this.#issue(
          { type: 'set-vga-gain', vgaGainDb: input.config.vgaGainDb - 2 },
          'adjusting-gain',
        )
      }
      if (input.config.lnaGainDb > 0) {
        return this.#issue(
          { type: 'set-lna-gain', lnaGainDb: input.config.lnaGainDb - 8 },
          'adjusting-gain',
        )
      }
    }

    if (peakPowerDbfs > OPERATING_LEVEL_HIGH_DBFS && input.config.vgaGainDb > 0) {
      return this.#issue(
        { type: 'set-vga-gain', vgaGainDb: input.config.vgaGainDb - 2 },
        'adjusting-gain',
      )
    }
    if (peakPowerDbfs < OPERATING_LEVEL_LOW_DBFS) {
      if (input.config.lnaGainDb < 40 && !this.#lnaProbeRejected) {
        this.#lnaProbe = {
          previousGainDb: input.config.lnaGainDb,
          candidateGainDb: input.config.lnaGainDb + 8,
          baselineSnrDb: snrDb,
        }
        return this.#issue(
          { type: 'set-lna-gain', lnaGainDb: this.#lnaProbe.candidateGainDb },
          'adjusting-gain',
        )
      }
      if (input.config.vgaGainDb < 62) {
        return this.#issue(
          { type: 'set-vga-gain', vgaGainDb: input.config.vgaGainDb + 2 },
          'adjusting-gain',
        )
      }
    }

    this.#lastOptimizedDetail =
      `Target level ${peakPowerDbfs.toFixed(1)} dBFS, SNR ${snrDb.toFixed(1)} dB.`
    return this.#result('optimized', null, this.#lastOptimizedDetail)
  }

  #selectTarget(input: HackRfAutoOptimizerInput): TrackedSignal | null {
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
      this.#lnaProbe = null
      this.#lnaProbeRejected = false
      this.#lastOptimizedDetail = null
    }

    return [...eligible].sort(compareTargetPriority)[0] ?? null
  }

  #issue(
    command: HackRfRuntimeCommand,
    status: 'retuning' | 'adjusting-gain',
  ): HackRfAutoOptimizerResult {
    this.#inFlight = command
    this.#observations = []
    this.#lastOptimizedDetail = null
    return this.#result(status, command, describeCommand(command))
  }

  #result(
    status: HackRfAutoOptimizeStatus,
    command: HackRfRuntimeCommand | null,
    detail: string,
  ): HackRfAutoOptimizerResult {
    return {
      status,
      targetFrequencyHz: this.#targetFrequencyHz,
      command,
      detail,
    }
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
  return Math.round(
    signal.classification.primary.channelCenterHz ?? signal.absoluteFrequencyHz!,
  )
}

function closestSignal(
  signals: readonly TrackedSignal[],
  frequencyHz: number,
): TrackedSignal | null {
  const matches = signals
    .map((signal) => ({ signal, differenceHz: Math.abs(signalFrequencyHz(signal) - frequencyHz) }))
    .filter(({ differenceHz }) => differenceHz <= TARGET_MATCH_TOLERANCE_HZ)
    .sort((left, right) => left.differenceHz - right.differenceHz)
  return matches[0]?.signal ?? null
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
  config: HackRfConfig,
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
  ) {
    return { supported: true, centerFrequencyHz: null }
  }

  const candidates = [
    targetFrequencyHz - PREFERRED_IF_OFFSET_HZ,
    targetFrequencyHz + PREFERRED_IF_OFFSET_HZ,
  ].filter((centerFrequencyHz) =>
    centerFrequencyHz >= 1_000_000 &&
    centerFrequencyHz <= 6_000_000_000 &&
    Math.abs(targetFrequencyHz - centerFrequencyHz) +
      halfSignalWidthHz +
      CAPTURE_EDGE_HEADROOM_HZ <= halfCaptureHz,
  )
  candidates.sort(
    (left, right) =>
      Math.abs(left - config.centerFrequencyHz) - Math.abs(right - config.centerFrequencyHz),
  )
  return {
    supported: candidates.length > 0,
    centerFrequencyHz: candidates[0] ?? null,
  }
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle]
}

function sameCommand(left: HackRfRuntimeCommand, right: HackRfRuntimeCommand): boolean {
  if (left.type !== right.type) return false
  if (left.type === 'set-center-frequency' && right.type === left.type) {
    return left.centerFrequencyHz === right.centerFrequencyHz
  }
  if (left.type === 'set-lna-gain' && right.type === left.type) {
    return left.lnaGainDb === right.lnaGainDb
  }
  return left.type === 'set-vga-gain' &&
    right.type === left.type &&
    left.vgaGainDb === right.vgaGainDb
}

function describeCommand(command: HackRfRuntimeCommand): string {
  if (command.type === 'set-center-frequency') {
    return `Retuning to ${(command.centerFrequencyHz / 1_000_000).toFixed(3)} MHz.`
  }
  if (command.type === 'set-lna-gain') return `Setting LNA gain to ${command.lnaGainDb} dB.`
  return `Setting VGA gain to ${command.vgaGainDb} dB.`
}