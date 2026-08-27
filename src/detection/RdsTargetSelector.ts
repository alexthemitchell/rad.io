import type { RdsDecodeTarget, TrackedSignal } from '../workers/protocol'

const DEFAULT_MAX_TARGETS = 4
const REQUIRED_CHANNEL_HEADROOM_HZ = 120_000
const RDS_TARGET_SAMPLE_BUDGET_HZ = 20_000_000

export type RdsTargetFrame = {
  centerFrequencyHz: number
  sampleRateHz: number
}

export type RdsTargetSelection = {
  targets: RdsDecodeTarget[]
  selectedSignalIds: string[]
  capacityLimitedSignalIds: string[]
}

export class RdsTargetSelector {
  readonly #maxTargets: number
  #selectedChannelCentersHz: number[] = []

  constructor(maxTargets = DEFAULT_MAX_TARGETS) {
    if (!Number.isInteger(maxTargets) || maxTargets < 1) {
      throw new Error('RDS target limit must be a positive integer.')
    }
    this.#maxTargets = maxTargets
  }

  update(
    signals: readonly TrackedSignal[],
    frame: RdsTargetFrame,
  ): RdsTargetSelection {
    const eligibleByChannel = new Map<number, TrackedSignal>()
    for (const signal of signals) {
      if (!isEligible(signal, frame)) continue
      const channelCenterHz = signal.classification.primary.channelCenterHz!
      const existing = eligibleByChannel.get(channelCenterHz)
      if (!existing || compareSignalPriority(signal, existing) < 0) {
        eligibleByChannel.set(channelCenterHz, signal)
      }
    }

    const retained = this.#selectedChannelCentersHz.filter((channelCenterHz) =>
      eligibleByChannel.has(channelCenterHz),
    )
    const retainedSet = new Set(retained)
    const additions = [...eligibleByChannel.entries()]
      .filter(([channelCenterHz]) => !retainedSet.has(channelCenterHz))
      .sort(([, left], [, right]) => compareSignalPriority(left, right))
      .map(([channelCenterHz]) => channelCenterHz)
    const targetLimit = Math.min(
      this.#maxTargets,
      Math.max(1, Math.floor(RDS_TARGET_SAMPLE_BUDGET_HZ / frame.sampleRateHz)),
    )
    this.#selectedChannelCentersHz = [...retained, ...additions].slice(0, targetLimit)

    const selectedSet = new Set(this.#selectedChannelCentersHz)
    const selectedSignals = this.#selectedChannelCentersHz
      .map((channelCenterHz) => eligibleByChannel.get(channelCenterHz))
      .filter((signal): signal is TrackedSignal => signal !== undefined)
    const capacityLimitedSignals = [...eligibleByChannel.entries()]
      .filter(([channelCenterHz]) => !selectedSet.has(channelCenterHz))
      .map(([, signal]) => signal)
      .sort(compareSignalPriority)

    return {
      targets: this.#selectedChannelCentersHz.map((channelCenterHz) => ({
        channelCenterHz,
        frequencyOffsetHz: channelCenterHz - frame.centerFrequencyHz,
      })),
      selectedSignalIds: selectedSignals.map((signal) => signal.id),
      capacityLimitedSignalIds: capacityLimitedSignals.map((signal) => signal.id),
    }
  }

  reset(): void {
    this.#selectedChannelCentersHz = []
  }
}

function isEligible(signal: TrackedSignal, frame: RdsTargetFrame): boolean {
  const channelCenterHz = signal.classification.primary.channelCenterHz
  return (
    signal.state === 'active' &&
    signal.classification.primary.category === 'fm-broadcast' &&
    channelCenterHz !== null &&
    !signal.edgeClipped &&
    Number.isFinite(frame.centerFrequencyHz) &&
    frame.centerFrequencyHz > 0 &&
    Number.isFinite(frame.sampleRateHz) &&
    frame.sampleRateHz > 0 &&
    Math.abs(channelCenterHz - frame.centerFrequencyHz) +
      REQUIRED_CHANNEL_HEADROOM_HZ <=
      frame.sampleRateHz / 2
  )
}

function compareSignalPriority(left: TrackedSignal, right: TrackedSignal): number {
  return (
    right.snrDb - left.snrDb ||
    right.classification.primary.score - left.classification.primary.score ||
    right.hitCount - left.hitCount ||
    left.id.localeCompare(right.id)
  )
}