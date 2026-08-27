import type { RdsReception, RdsStationMetadata } from '../workers/protocol'

const RDS_SEARCH_TIMEOUT_US = 5_000_000n

type WasmRdsMetadata = Omit<RdsStationMetadata, 'groupsByType'> & {
  groupsByType: Array<number | bigint>
}

export type WasmRdsChannelSnapshot = {
  channelCenterHz: number
  reception: {
    metadata: WasmRdsMetadata
    statistics: {
      synchronized: boolean
      validGroups: number | bigint
      correctedBlocks: number | bigint
      rejectedGroups: number | bigint
      lostSyncCount: number | bigint
    }
  }
}

export function mapRdsReception(snapshot: WasmRdsChannelSnapshot): RdsReception {
  const { metadata, statistics } = snapshot.reception
  return {
    channelCenterHz: snapshot.channelCenterHz,
    state: statistics.synchronized ? 'locked' : 'searching',
    reason: null,
    metadata: {
      ...metadata,
      groupsByType: metadata.groupsByType.map(Number),
    },
    diagnostics: {
      synchronized: statistics.synchronized,
      validGroups: Number(statistics.validGroups),
      correctedBlocks: Number(statistics.correctedBlocks),
      rejectedGroups: Number(statistics.rejectedGroups),
      lostSyncCount: Number(statistics.lostSyncCount),
      lastValidGroupAtUs: metadata.lastValidGroupAtUs,
    },
  }
}

export function emptyRdsReception(
  channelCenterHz: number,
  state: RdsReception['state'],
  reason: string | null,
): RdsReception {
  return {
    channelCenterHz,
    state,
    reason,
    metadata: null,
    diagnostics: {
      synchronized: false,
      validGroups: 0,
      correctedBlocks: 0,
      rejectedGroups: 0,
      lostSyncCount: 0,
      lastValidGroupAtUs: null,
    },
  }
}

export function pendingRdsReception(
  channelCenterHz: number,
  acquisitionElapsedUs: bigint,
): RdsReception {
  if (acquisitionElapsedUs < RDS_SEARCH_TIMEOUT_US) {
    return emptyRdsReception(channelCenterHz, 'searching', null)
  }
  return emptyRdsReception(
    channelCenterHz,
    'unavailable',
    'No valid RDS groups received. This station may not transmit RDS, or its subcarrier may be too weak.',
  )
}