import type { RdsReception, RdsStationMetadata } from '../workers/protocol'

const RDS_SEARCH_TIMEOUT_US = 5_000_000n

type WasmValue<T> = T extends bigint
  ? number | bigint
  : T extends object
    ? { [Key in keyof T]: WasmValue<T[Key]> }
    : T

type WasmRdsMetadata = Omit<WasmValue<RdsStationMetadata>, 'groupsByType'> & {
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
  const normalizedMetadata: RdsStationMetadata = {
    ...metadata,
    pi: normalizeTimedValue(metadata.pi),
    callSign: normalizeTimedValue(metadata.callSign),
    ps: normalizeTimedValue(metadata.ps),
    pty: normalizeTimedValue(metadata.pty),
    ptyName: normalizeTimedValue(metadata.ptyName),
    ptyn: normalizeTimedValue(metadata.ptyn),
    trafficProgram: normalizeTimedValue(metadata.trafficProgram),
    trafficAnnouncement: normalizeTimedValue(metadata.trafficAnnouncement),
    musicSpeech: normalizeTimedValue(metadata.musicSpeech),
    decoderInfo: normalizeTimedValue(metadata.decoderInfo),
    alternativeFrequencies: normalizeTimedValue(metadata.alternativeFrequencies),
    extendedCountryCode: normalizeTimedValue(metadata.extendedCountryCode),
    programItemNumber: normalizeTimedValue(metadata.programItemNumber),
    radioText: normalizeTimedValue(metadata.radioText),
    clockTime: normalizeTimedValue(metadata.clockTime),
    odaRegistrations: metadata.odaRegistrations.map(normalizeRequiredTimedValue),
    tmcMessages: metadata.tmcMessages.map(normalizeReceivedAtUs),
    eonRecords: metadata.eonRecords.map(normalizeReceivedAtUs),
    rawGroups: metadata.rawGroups.map(normalizeReceivedAtUs),
    groupsByType: metadata.groupsByType.map(Number),
    lastValidGroupAtUs: normalizeOptionalTimestampUs(metadata.lastValidGroupAtUs),
  }
  return {
    channelCenterHz: snapshot.channelCenterHz,
    state: statistics.synchronized ? 'locked' : 'searching',
    reason: null,
    metadata: normalizedMetadata,
    diagnostics: {
      synchronized: statistics.synchronized,
      validGroups: Number(statistics.validGroups),
      correctedBlocks: Number(statistics.correctedBlocks),
      rejectedGroups: Number(statistics.rejectedGroups),
      lostSyncCount: Number(statistics.lostSyncCount),
      lastValidGroupAtUs: normalizedMetadata.lastValidGroupAtUs,
    },
  }
}

function normalizeTimedValue<T extends { updatedAtUs: number | bigint }>(
  value: T | null,
): (Omit<T, 'updatedAtUs'> & { updatedAtUs: bigint }) | null {
  if (!value) return null
  return normalizeRequiredTimedValue(value)
}

function normalizeRequiredTimedValue<T extends { updatedAtUs: number | bigint }>(
  value: T,
): Omit<T, 'updatedAtUs'> & { updatedAtUs: bigint } {
  return { ...value, updatedAtUs: normalizeTimestampUs(value.updatedAtUs) }
}

function normalizeReceivedAtUs<T extends { receivedAtUs: number | bigint }>(
  value: T,
): Omit<T, 'receivedAtUs'> & { receivedAtUs: bigint } {
  return { ...value, receivedAtUs: normalizeTimestampUs(value.receivedAtUs) }
}

function normalizeOptionalTimestampUs(value: number | bigint | null): bigint | null {
  return value === null ? null : normalizeTimestampUs(value)
}

function normalizeTimestampUs(value: number | bigint): bigint {
  return typeof value === 'bigint' ? value : BigInt(Math.round(value))
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