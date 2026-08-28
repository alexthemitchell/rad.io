import type { BandPlan, BandPlanEntry } from './types'

const CFR_FREQUENCY_TABLE =
  'https://www.ecfr.gov/current/title-47/chapter-I/subchapter-A/part-2/subpart-B/section-2.106'
const CFR_BROADCAST =
  'https://www.ecfr.gov/current/title-47/chapter-I/subchapter-C/part-73'
const CFR_AVIATION =
  'https://www.ecfr.gov/current/title-47/chapter-I/subchapter-D/part-87'
const CFR_AMATEUR =
  'https://www.ecfr.gov/current/title-47/chapter-I/subchapter-D/part-97/section-97.301'
const NIST_WWV =
  'https://www.nist.gov/pml/time-and-frequency-division/time-distribution/radio-station-wwv'
const NIST_WWVB =
  'https://www.nist.gov/pml/time-and-frequency-division/time-distribution/radio-station-wwvb'

function channelEntries(
  prefix: string,
  category: BandPlanEntry['category'],
  firstCenterHz: number,
  lastCenterHz: number,
  spacingHz: number,
  expectedBandwidthHz: readonly [number, number],
  sourceUrl: string,
  label: (centerHz: number, index: number) => string,
): BandPlanEntry[] {
  const entries: BandPlanEntry[] = []
  for (
    let centerHz = firstCenterHz, index = 0;
    centerHz <= lastCenterHz;
    centerHz += spacingHz, index += 1
  ) {
    entries.push({
      id: `${prefix}-${Math.round(centerHz)}`,
      label: label(centerHz, index),
      category,
      frequencyRangeHz: [centerHz - spacingHz / 2, centerHz + spacingHz / 2],
      expectedBandwidthHz,
      channelCenterHz: centerHz,
      channelToleranceHz: spacingHz / 2,
      sourceUrl,
    })
  }
  return entries
}

function televisionEntries(): BandPlanEntry[] {
  const ranges: Array<[number, number, number]> = [
    [2, 4, 54_000_000],
    [5, 6, 76_000_000],
    [7, 13, 174_000_000],
    [14, 36, 470_000_000],
  ]
  const entries: BandPlanEntry[] = []
  for (const [firstChannel, lastChannel, firstLowerHz] of ranges) {
    for (let channel = firstChannel; channel <= lastChannel; channel += 1) {
      const lowerHz = firstLowerHz + (channel - firstChannel) * 6_000_000
      entries.push({
        id: `tv-${channel}`,
        label: `Broadcast television channel ${channel}`,
        category: 'television',
        frequencyRangeHz: [lowerHz, lowerHz + 6_000_000],
        expectedBandwidthHz: [5_000_000, 6_000_000],
        channelCenterHz: lowerHz + 3_000_000,
        channelToleranceHz: 3_000_000,
        sourceUrl: CFR_BROADCAST,
      })
    }
  }
  return entries
}

const amateurRanges: Array<[string, number, number]> = [
  ['160 m', 1_800_000, 2_000_000],
  ['80 m', 3_500_000, 4_000_000],
  ['60 m', 5_351_500, 5_366_500],
  ['40 m', 7_000_000, 7_300_000],
  ['30 m', 10_100_000, 10_150_000],
  ['20 m', 14_000_000, 14_350_000],
  ['17 m', 18_068_000, 18_168_000],
  ['15 m', 21_000_000, 21_450_000],
  ['12 m', 24_890_000, 24_990_000],
  ['10 m', 28_000_000, 29_700_000],
  ['6 m', 50_000_000, 54_000_000],
  ['2 m', 144_000_000, 148_000_000],
  ['1.25 m', 222_000_000, 225_000_000],
  ['70 cm', 420_000_000, 450_000_000],
  ['33 cm', 902_000_000, 928_000_000],
  ['23 cm', 1_240_000_000, 1_300_000_000],
]

const amBroadcastEntries = channelEntries(
  'am',
  'am-broadcast',
  540_000,
  1_700_000,
  10_000,
  [8_000, 20_000],
  CFR_BROADCAST,
  (centerHz) => `AM broadcast ${Math.round(centerHz / 1_000)} kHz`,
)

const fmBroadcastEntries = channelEntries(
  'fm',
  'fm-broadcast',
  88_100_000,
  107_900_000,
  200_000,
  [100_000, 300_000],
  CFR_BROADCAST,
  (centerHz, index) =>
    `FM broadcast channel ${201 + index} (${(centerHz / 1_000_000).toFixed(1)} MHz)`,
)

const standardTimeEntries: BandPlanEntry[] = [
  {
    id: 'standard-time-60000',
    label: 'Standard time/frequency 60 kHz (WWVB)',
    category: 'standard-time-frequency',
    frequencyRangeHz: [57_500, 62_500],
    expectedBandwidthHz: [1, 5_000],
    channelCenterHz: 60_000,
    channelToleranceHz: 2_500,
    sourceUrl: NIST_WWVB,
  },
  ...[2_500_000, 5_000_000, 10_000_000, 15_000_000, 20_000_000, 25_000_000].map(
    (centerHz): BandPlanEntry => ({
      id: `standard-time-${centerHz}`,
      label: `Standard time/frequency ${centerHz / 1_000_000} MHz`,
      category: 'standard-time-frequency',
      frequencyRangeHz: [centerHz - 2_500, centerHz + 2_500],
      expectedBandwidthHz: [100, 20_000],
      channelCenterHz: centerHz,
      channelToleranceHz: 2_500,
      sourceUrl: NIST_WWV,
    }),
  ),
]

const amateurEntries: BandPlanEntry[] = amateurRanges.map(
  ([band, lowerHz, upperHz]) => ({
    id: `amateur-${band.replaceAll('.', '-').replaceAll(' ', '-')}`,
    label: `${band} amateur allocation`,
    category: 'amateur',
    frequencyRangeHz: [lowerHz, upperHz],
    sourceUrl: CFR_AMATEUR,
  }),
)

const aviationEntries: BandPlanEntry[] = [
  {
    id: 'aviation-vhf-communications',
    label: 'Civil VHF aviation communications',
    category: 'aviation',
    frequencyRangeHz: [118_000_000, 137_000_000],
    expectedBandwidthHz: [6_000, 30_000],
    sourceUrl: CFR_AVIATION,
  },
]

export const FCC_US_BAND_PLAN: BandPlan = {
  id: 'fcc-us',
  label: 'FCC / United States',
  region: 'United States',
  revision: '2026-08',
  entries: [
    ...amBroadcastEntries,
    ...fmBroadcastEntries,
    ...standardTimeEntries,
    ...amateurEntries,
    ...aviationEntries,
    ...televisionEntries(),
  ],
  sourceUrls: [
    CFR_FREQUENCY_TABLE,
    CFR_BROADCAST,
    CFR_AVIATION,
    CFR_AMATEUR,
    NIST_WWV,
    NIST_WWVB,
  ],
}