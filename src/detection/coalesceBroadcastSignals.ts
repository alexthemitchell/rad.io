import type { RdsReception, TrackedSignal } from '../workers/protocol'

export function coalesceBroadcastSignals(
  signals: readonly TrackedSignal[],
): TrackedSignal[] {
  const groups = new Map<string, TrackedSignal[]>()
  for (const signal of signals) {
    const key = broadcastChannelKey(signal)
    if (!key) continue
    const group = groups.get(key)
    if (group) group.push(signal)
    else groups.set(key, [signal])
  }

  const emitted = new Set<string>()
  return signals.flatMap((signal) => {
    const key = broadcastChannelKey(signal)
    if (!key) return [signal]
    if (emitted.has(key)) return []
    emitted.add(key)
    const group = groups.get(key)!
    return [group.length === 1 ? signal : mergeBroadcastGroup(group)]
  })
}

function broadcastChannelKey(signal: TrackedSignal): string | null {
  const candidate = signal.classification.primary
  if (
    candidate.category !== 'fm-broadcast' ||
    candidate.allocationId === null ||
    candidate.channelCenterHz === null
  ) {
    return null
  }
  return `${signal.classification.profileId}:${candidate.allocationId}:${candidate.channelCenterHz}`
}

function mergeBroadcastGroup(group: readonly TrackedSignal[]): TrackedSignal {
  const active = group.filter((signal) => signal.state === 'active')
  const measurements = active.length > 0 ? active : group
  const measurement = [...measurements].sort(compareMeasurements)[0]
  const anchor = [...group].sort(
    (left, right) =>
      compareBigInt(left.firstSeenUs, right.firstSeenUs) || left.id.localeCompare(right.id),
  )[0]
  const firstSeenUs = group.reduce(
    (earliest, signal) => (signal.firstSeenUs < earliest ? signal.firstSeenUs : earliest),
    group[0].firstSeenUs,
  )
  const lastSeenUs = group.reduce(
    (latest, signal) => (signal.lastSeenUs > latest ? signal.lastSeenUs : latest),
    group[0].lastSeenUs,
  )
  const lowerOffsetHz = Math.min(...measurements.map((signal) => signal.lowerOffsetHz))
  const upperOffsetHz = Math.max(...measurements.map((signal) => signal.upperOffsetHz))
  const absoluteRanges = measurements.filter(
    (signal) => signal.lowerFrequencyHz !== null && signal.upperFrequencyHz !== null,
  )
  const lowerFrequencyHz =
    absoluteRanges.length === 0
      ? null
      : Math.min(...absoluteRanges.map((signal) => signal.lowerFrequencyHz!))
  const upperFrequencyHz =
    absoluteRanges.length === 0
      ? null
      : Math.max(...absoluteRanges.map((signal) => signal.upperFrequencyHz!))

  return {
    ...measurement,
    id: anchor.id,
    lowerOffsetHz,
    upperOffsetHz,
    lowerFrequencyHz,
    upperFrequencyHz,
    bandwidthHz:
      lowerFrequencyHz === null || upperFrequencyHz === null
        ? upperOffsetHz - lowerOffsetHz
        : upperFrequencyHz - lowerFrequencyHz,
    firstSeenUs,
    lastSeenUs,
    durationUs: lastSeenUs >= firstSeenUs ? lastSeenUs - firstSeenUs : 0n,
    hitCount: Math.max(...group.map((signal) => signal.hitCount)),
    state: active.length > 0 ? 'active' : 'recent',
    edgeClipped: measurements.some((signal) => signal.edgeClipped),
    rds: selectReception(group),
  }
}

function compareMeasurements(left: TrackedSignal, right: TrackedSignal): number {
  return (
    right.classification.primary.score - left.classification.primary.score ||
    right.snrDb - left.snrDb ||
    right.peakPowerDbfs - left.peakPowerDbfs ||
    left.id.localeCompare(right.id)
  )
}

function selectReception(group: readonly TrackedSignal[]): RdsReception | undefined {
  return [...group]
    .filter((signal): signal is TrackedSignal & { rds: RdsReception } => signal.rds !== undefined)
    .sort((left, right) => receptionRank(left.rds) - receptionRank(right.rds))[0]?.rds
}

function receptionRank(reception: RdsReception): number {
  switch (reception.state) {
    case 'locked':
      return 0
    case 'stale':
      return 1
    case 'searching':
      return 2
    case 'capacity-limited':
      return 3
    case 'unavailable':
      return 4
  }
}

function compareBigInt(left: bigint, right: bigint): number {
  return left < right ? -1 : left > right ? 1 : 0
}