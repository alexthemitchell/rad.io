import { describe, expect, it } from 'vitest'
import type { SignalServiceCategory, TrackedSignal } from '../workers/protocol'
import { suggestVfoFromSignal } from './suggestVfoFromSignal'

function signal(
  category: SignalServiceCategory,
  absoluteFrequencyHz: number | null,
  channelCenterHz: number | null = null,
): TrackedSignal {
  return {
    id: 'signal-1',
    peakOffsetHz: 0,
    lowerOffsetHz: -5_000,
    upperOffsetHz: 5_000,
    absoluteFrequencyHz,
    lowerFrequencyHz: null,
    upperFrequencyHz: null,
    bandwidthHz: 10_000,
    peakPowerDbfs: -40,
    snrDb: 20,
    edgeClipped: false,
    firstSeenUs: 0n,
    lastSeenUs: 1n,
    durationUs: 1n,
    hitCount: 10,
    state: 'active',
    classification: {
      profileId: 'fcc-us',
      spectralShape: 'narrowband',
      primary: {
        allocationId: null,
        channelCenterHz,
        label: 'Detected service',
        category,
        score: 0.8,
        reasons: [],
        caveats: [],
      },
      alternatives: [],
    },
  }
}

describe('suggestVfoFromSignal', () => {
  it.each([
    ['fm-broadcast', 'wbfm'],
    ['am-broadcast', 'am'],
    ['aviation', 'am'],
    ['amateur', 'nbfm'],
    ['unknown', 'nbfm'],
  ] as const)('suggests %s as %s', (category, mode) => {
    expect(suggestVfoFromSignal(signal(category, 100_123_456))).toMatchObject({ mode })
  })

  it('prefers the classified channel center and station name', () => {
    const tracked = signal('fm-broadcast', 100_086_000, 100_100_000)
    tracked.rds = {
      channelCenterHz: 100_100_000,
      state: 'locked',
      reason: null,
      diagnostics: {
        synchronized: true,
        validGroups: 1,
        correctedBlocks: 0,
        rejectedGroups: 0,
        lostSyncCount: 0,
        lastValidGroupAtUs: 1n,
      },
      metadata: {
        pi: null,
        callSign: null,
        ps: { value: 'RADIO', complete: true, updatedAtUs: 1n },
        pty: null,
        ptyName: null,
        ptyn: null,
        trafficProgram: null,
        trafficAnnouncement: null,
        musicSpeech: null,
        decoderInfo: null,
        alternativeFrequencies: null,
        extendedCountryCode: null,
        programItemNumber: null,
        radioText: null,
        clockTime: null,
        odaRegistrations: [],
        tmcMessages: [],
        eonRecords: [],
        rawGroups: [],
        groupsByType: [],
        lastValidGroupAtUs: 1n,
      },
    }

    expect(suggestVfoFromSignal(tracked)).toEqual({
      frequencyHz: 100_100_000,
      mode: 'wbfm',
      label: 'RADIO',
    })
  })

  it('does not suggest a receiver without an RF frequency', () => {
    expect(suggestVfoFromSignal(signal('unknown', null))).toBeNull()
  })
})