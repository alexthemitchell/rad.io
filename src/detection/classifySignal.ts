import { FCC_US_BAND_PLAN } from './bandPlans/fccUs'
import type { BandPlan, BandPlanEntry } from './bandPlans/types'
import type {
  BandPlanId,
  ClassificationCandidate,
  SignalClassification,
  SpectralShape,
} from '../workers/protocol'

export type ClassificationInput = {
  absoluteFrequencyHz: number | null
  bandwidthHz: number
  snrDb: number
  hitCount: number
  edgeClipped: boolean
  captureBandwidthHz: number
  binWidthHz: number
}

export function classifySignal(
  input: ClassificationInput,
  profileId: BandPlanId,
): SignalClassification {
  const spectralShape = classifySpectralShape(input)
  if (profileId === 'none' || input.absoluteFrequencyHz === null) {
    return unknownClassification(
      profileId,
      spectralShape,
      profileId === 'none'
        ? 'Band-plan classification is disabled.'
        : 'Absolute RF frequency is unavailable for this baseband capture.',
    )
  }

  const candidates = matchingEntries(FCC_US_BAND_PLAN, input).map((entry) =>
    scoreEntry(entry, input),
  )
  candidates.sort(
    (left, right) => right.score - left.score || left.label.localeCompare(right.label),
  )
  const primary = candidates[0]
  if (!primary) {
    return unknownClassification(
      profileId,
      spectralShape,
      'No allocation in the selected profile contains the measured frequency.',
    )
  }

  return {
    profileId,
    spectralShape,
    primary,
    alternatives: candidates.slice(1, 3),
  }
}

function classifySpectralShape(input: ClassificationInput): SpectralShape {
  if (input.edgeClipped) return 'partial'
  if (input.bandwidthHz <= Math.max(2_000, input.binWidthHz * 2)) {
    return 'carrier-like'
  }
  if (input.bandwidthHz <= 25_000) return 'narrowband'
  if (input.bandwidthHz <= 300_000) return 'medium-band'
  return 'wideband'
}

function matchingEntries(plan: BandPlan, input: ClassificationInput): BandPlanEntry[] {
  const frequencyHz = input.absoluteFrequencyHz
  if (frequencyHz === null) return []
  return plan.entries.filter(
    (entry) =>
      frequencyHz >= entry.frequencyRangeHz[0] &&
      frequencyHz <= entry.frequencyRangeHz[1],
  )
}

function scoreEntry(
  entry: BandPlanEntry,
  input: ClassificationInput,
): ClassificationCandidate {
  let score = 0.55
  const reasons = [`Frequency is inside ${entry.label}.`]
  const caveats: string[] = []

  if (entry.channelCenterHz !== undefined) {
    const toleranceHz =
      entry.channelToleranceHz ??
      (entry.frequencyRangeHz[1] - entry.frequencyRangeHz[0]) / 2
    const distanceHz = Math.abs(input.absoluteFrequencyHz! - entry.channelCenterHz)
    const proximity = Math.max(0, 1 - distanceHz / Math.max(1, toleranceHz))
    score += proximity * 0.12
    reasons.push(`Carrier is ${formatHertz(distanceHz)} from the listed channel center.`)
  }

  if (entry.expectedBandwidthHz) {
    const [minimumHz, maximumHz] = entry.expectedBandwidthHz
    if (input.bandwidthHz >= minimumHz && input.bandwidthHz <= maximumHz) {
      score += 0.15
      reasons.push('Measured occupied bandwidth fits the profile range.')
    } else if (input.edgeClipped || input.captureBandwidthHz < minimumHz) {
      score += 0.03
      caveats.push('The capture does not contain the full expected channel bandwidth.')
    } else {
      score -= 0.15
      caveats.push('Measured occupied bandwidth does not fit the profile range.')
    }
  } else {
    reasons.push('This allocation permits multiple signal bandwidths and modes.')
  }

  const snrContribution = Math.min(0.12, Math.max(0, input.snrDb - 10) * 0.0024)
  score += snrContribution
  if (snrContribution > 0) reasons.push(`Signal is ${input.snrDb.toFixed(1)} dB above noise.`)

  const persistenceContribution = Math.min(0.08, Math.max(0, input.hitCount - 2) * 0.02)
  score += persistenceContribution
  if (input.hitCount >= 3) reasons.push(`Signal persisted for ${input.hitCount} analyzed frames.`)

  if (input.edgeClipped) {
    score = Math.min(score, 0.72)
    caveats.push('Signal energy reaches a capture edge; bandwidth is a lower bound.')
  }

  return {
    allocationId: entry.id,
    label: entry.label,
    category: entry.category,
    score: clampScore(score),
    reasons,
    caveats,
  }
}

function unknownClassification(
  profileId: BandPlanId,
  spectralShape: SpectralShape,
  reason: string,
): SignalClassification {
  return {
    profileId,
    spectralShape,
    primary: {
      allocationId: null,
      label: 'Unknown service',
      category: 'unknown',
      score: 0,
      reasons: [reason],
      caveats: ['Classification requires allocation context and is not decoded identity.'],
    },
    alternatives: [],
  }
}

function clampScore(score: number): number {
  return Math.round(Math.max(0, Math.min(0.98, score)) * 100) / 100
}

function formatHertz(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(3)} MHz`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)} kHz`
  return `${Math.round(value)} Hz`
}