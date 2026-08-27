import type {
  BandPlanId,
  SignalServiceCategory,
} from '../../workers/protocol'

export type BandPlanEntry = {
  id: string
  label: string
  category: Exclude<SignalServiceCategory, 'unknown'>
  frequencyRangeHz: readonly [number, number]
  expectedBandwidthHz?: readonly [number, number]
  channelCenterHz?: number
  channelToleranceHz?: number
  sourceUrl: string
}

export type BandPlan = {
  id: BandPlanId
  label: string
  region: string
  revision: string
  entries: readonly BandPlanEntry[]
  sourceUrls: readonly string[]
}