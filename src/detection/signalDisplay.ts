import type { TrackedSignal } from '../workers/protocol'

export function signalDisplayFrequencyHz(signal: TrackedSignal): number | null {
  return signal.classification.primary.channelCenterHz ?? signal.absoluteFrequencyHz
}

export function signalDisplayOffsetHz(
  signal: TrackedSignal,
  centerFrequencyHz: number,
): number {
  const displayFrequencyHz = signalDisplayFrequencyHz(signal)
  return displayFrequencyHz === null
    ? signal.peakOffsetHz
    : displayFrequencyHz - centerFrequencyHz
}

export function signalDisplayRangeOffsetsHz(
  signal: TrackedSignal,
  centerFrequencyHz: number,
): readonly [number, number] {
  const channelCenterHz = signal.classification.primary.channelCenterHz
  const channelHalfWidthHz =
    signal.classification.primary.category === 'fm-broadcast'
      ? 100_000
      : signal.classification.primary.category === 'am-broadcast'
        ? 5_000
        : null
  if (channelCenterHz === null || channelHalfWidthHz === null) {
    return [signal.lowerOffsetHz, signal.upperOffsetHz]
  }
  const channelOffsetHz = channelCenterHz - centerFrequencyHz
  return [
    channelOffsetHz - channelHalfWidthHz,
    channelOffsetHz + channelHalfWidthHz,
  ]
}