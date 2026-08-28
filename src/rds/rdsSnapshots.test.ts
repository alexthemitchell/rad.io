import { describe, expect, it } from 'vitest'
import {
  mapRdsReception,
  pendingRdsReception,
  type WasmRdsChannelSnapshot,
} from './rdsSnapshots'

describe('pendingRdsReception', () => {
  it('reports searching while the decoder acquisition window is open', () => {
    const reception = pendingRdsReception(100_300_000, 4_999_999n)

    expect(reception.state).toBe('searching')
    expect(reception.reason).toBeNull()
  })

  it('explains missing station data after the acquisition window', () => {
    const reception = pendingRdsReception(100_300_000, 5_000_000n)

    expect(reception.state).toBe('unavailable')
    expect(reception.reason).toContain('may not transmit RDS')
  })
})

describe('mapRdsReception', () => {
  it('normalizes numeric WASM timestamps to bigint throughout metadata', () => {
    const snapshot: WasmRdsChannelSnapshot = {
      channelCenterHz: 100_300_000,
      reception: {
        metadata: {
          pi: { value: 0x187f, updatedAtUs: 100 },
          callSign: null,
          ps: null,
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
          odaRegistrations: [{
            value: {
              applicationGroupType: 8,
              applicationGroupVersion: 'A',
              applicationId: 0xcd46,
              messageBits: 0,
            },
            updatedAtUs: 110,
          }],
          tmcMessages: [{ variantCode: 1, blockC: 2, blockD: 3, receivedAtUs: 120 }],
          eonRecords: [{
            groupType: 14,
            version: 'A',
            variantCode: 1,
            information: 2,
            otherNetworkPi: 3,
            receivedAtUs: 130,
          }],
          rawGroups: [{
            groupType: 0,
            version: 'A',
            blocks: [1, 2, 3, 4],
            correctedBlocks: 0,
            applicationId: null,
            receivedAtUs: 140,
          }],
          groupsByType: [1n, 2],
          lastValidGroupAtUs: 150,
        },
        statistics: {
          synchronized: true,
          validGroups: 2n,
          correctedBlocks: 1,
          rejectedGroups: 0,
          lostSyncCount: 0,
        },
      },
    }

    const reception = mapRdsReception(snapshot)

    expect(reception.metadata?.pi?.updatedAtUs).toBe(100n)
    expect(reception.metadata?.odaRegistrations[0].updatedAtUs).toBe(110n)
    expect(reception.metadata?.tmcMessages[0].receivedAtUs).toBe(120n)
    expect(reception.metadata?.eonRecords[0].receivedAtUs).toBe(130n)
    expect(reception.metadata?.rawGroups[0].receivedAtUs).toBe(140n)
    expect(reception.metadata?.groupsByType).toEqual([1, 2])
    expect(reception.diagnostics.lastValidGroupAtUs).toBe(150n)
  })
})