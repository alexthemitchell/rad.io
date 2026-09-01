import type { TrackedSignal } from '../workers/protocol'
import type { AddVfoInput } from './vfoState'
import type { VfoMode } from './types'

export function suggestVfoFromSignal(
  signal: TrackedSignal,
): Omit<AddVfoInput, 'sourceSessionId'> | null {
  const suggestedFrequencyHz =
    signal.classification.primary.channelCenterHz ?? signal.absoluteFrequencyHz
  if (
    suggestedFrequencyHz === null ||
    !Number.isFinite(suggestedFrequencyHz) ||
    suggestedFrequencyHz < 0
  ) {
    return null
  }

  return {
    frequencyHz: Math.round(suggestedFrequencyHz),
    mode: suggestedMode(signal),
    label:
      signal.rds?.metadata?.ps?.value.trim() ||
      signal.classification.primary.label,
  }
}

function suggestedMode(signal: TrackedSignal): VfoMode {
  switch (signal.classification.primary.category) {
    case 'fm-broadcast':
      return 'wbfm'
    case 'am-broadcast':
    case 'aviation':
    case 'standard-time-frequency':
      return 'am'
    default:
      return 'nbfm'
  }
}