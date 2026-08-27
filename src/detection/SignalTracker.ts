import type { SpectralDetection } from '../workers/protocol'

const CONFIRMATION_HITS = 3
const RECENT_FRAME_LIMIT = 15
const MAX_TRACKS = 64
const SMOOTHING = 0.35
const MAX_RF_SHAKE_HZ = 50_000
const RF_SHAKE_CAPTURE_FRACTION = 0.025
const MIN_RF_SHAKE_BINS = 8

export type SignalTrackerFrame = {
  centerFrequencyHz: number
  sampleRateHz: number
  binWidthHz: number
  timestampUs: bigint
}

export type TrackedSignalMeasurement = {
  id: string
  peakOffsetHz: number
  lowerOffsetHz: number
  upperOffsetHz: number
  absoluteFrequencyHz: number | null
  lowerFrequencyHz: number | null
  upperFrequencyHz: number | null
  bandwidthHz: number
  peakPowerDbfs: number
  snrDb: number
  edgeClipped: boolean
  firstSeenUs: bigint
  lastSeenUs: bigint
  durationUs: bigint
  hitCount: number
  state: 'active' | 'recent'
  captureBandwidthHz: number
  binWidthHz: number
}

type MutableTrack = TrackedSignalMeasurement & {
  missedFrames: number
  confirmed: boolean
}

type Candidate = Omit<
  TrackedSignalMeasurement,
  'id' | 'firstSeenUs' | 'lastSeenUs' | 'durationUs' | 'hitCount' | 'state'
>

export class SignalTracker {
  readonly #tracks = new Map<string, MutableTrack>()
  #nextId = 1

  update(
    detections: readonly SpectralDetection[],
    frame: SignalTrackerFrame,
  ): TrackedSignalMeasurement[] {
    const candidates = detections.map((detection) => toCandidate(detection, frame))
    const matches = this.#matchCandidates(candidates, frame)
    const unmatchedTrackIds = new Set(this.#tracks.keys())

    for (const [index, candidate] of candidates.entries()) {
      const match = matches.get(index)
      if (match) {
        updateTrack(match, candidate, frame)
        unmatchedTrackIds.delete(match.id)
      } else {
        const track = createTrack(`signal-${this.#nextId}`, candidate, frame)
        this.#nextId += 1
        this.#tracks.set(track.id, track)
      }
    }

    for (const trackId of unmatchedTrackIds) {
      const track = this.#tracks.get(trackId)
      if (!track) continue
      track.missedFrames += 1
      track.state = 'recent'
      if (track.missedFrames > RECENT_FRAME_LIMIT || !track.confirmed) {
        this.#tracks.delete(trackId)
      }
    }

    this.#enforceBound()
    return [...this.#tracks.values()]
      .filter((track) => track.confirmed)
      .sort(
        (left, right) =>
          stateRank(left.state) - stateRank(right.state) ||
          right.peakPowerDbfs - left.peakPowerDbfs ||
          left.id.localeCompare(right.id),
      )
      .map(copyMeasurement)
  }

  reset(): void {
    this.#tracks.clear()
    this.#nextId = 1
  }

  #matchCandidates(
    candidates: readonly Candidate[],
    frame: SignalTrackerFrame,
  ): Map<number, MutableTrack> {
    const tracks = [...this.#tracks.values()]
    const candidatesByTrack = new Map<string, number>()
    const tracksByCandidate = new Map<number, MutableTrack>()
    const options = candidates.map((candidate) =>
      tracks
        .filter((track) => canAssociate(track, candidate, frame))
        .sort(
          (left, right) =>
            associationDistance(left, candidate) - associationDistance(right, candidate),
        ),
    )

    const assign = (candidateIndex: number, visitedTrackIds: Set<string>): boolean => {
      for (const track of options[candidateIndex]) {
        if (visitedTrackIds.has(track.id)) continue
        visitedTrackIds.add(track.id)
        const incumbent = candidatesByTrack.get(track.id)
        if (incumbent !== undefined && !assign(incumbent, visitedTrackIds)) continue
        candidatesByTrack.set(track.id, candidateIndex)
        tracksByCandidate.set(candidateIndex, track)
        return true
      }
      return false
    }

    for (const candidateIndex of candidates.keys()) {
      assign(candidateIndex, new Set())
    }
    return tracksByCandidate
  }

  #enforceBound(): void {
    if (this.#tracks.size <= MAX_TRACKS) return
    const retained = [...this.#tracks.values()]
      .sort(
        (left, right) =>
          Number(right.confirmed) - Number(left.confirmed) ||
          left.missedFrames - right.missedFrames ||
          right.peakPowerDbfs - left.peakPowerDbfs,
      )
      .slice(0, MAX_TRACKS)
    this.#tracks.clear()
    for (const track of retained) this.#tracks.set(track.id, track)
  }
}

function toCandidate(
  detection: SpectralDetection,
  frame: SignalTrackerFrame,
): Candidate {
  const hasAbsoluteFrequency = frame.centerFrequencyHz > 0
  return {
    peakOffsetHz: detection.peakFrequencyHz,
    lowerOffsetHz: detection.lowerFrequencyHz,
    upperOffsetHz: detection.upperFrequencyHz,
    absoluteFrequencyHz: hasAbsoluteFrequency
      ? frame.centerFrequencyHz + detection.peakFrequencyHz
      : null,
    lowerFrequencyHz: hasAbsoluteFrequency
      ? frame.centerFrequencyHz + detection.lowerFrequencyHz
      : null,
    upperFrequencyHz: hasAbsoluteFrequency
      ? frame.centerFrequencyHz + detection.upperFrequencyHz
      : null,
    bandwidthHz: detection.bandwidthHz,
    peakPowerDbfs: detection.peakPowerDbfs,
    snrDb: detection.snrDb,
    edgeClipped: detection.edgeClipped,
    captureBandwidthHz: frame.sampleRateHz,
    binWidthHz: frame.binWidthHz,
  }
}

function createTrack(
  id: string,
  candidate: Candidate,
  frame: SignalTrackerFrame,
): MutableTrack {
  return {
    id,
    ...candidate,
    firstSeenUs: frame.timestampUs,
    lastSeenUs: frame.timestampUs,
    durationUs: 0n,
    hitCount: 1,
    state: 'active',
    missedFrames: 0,
    confirmed: false,
  }
}

function updateTrack(
  track: MutableTrack,
  candidate: Candidate,
  frame: SignalTrackerFrame,
): void {
  track.bandwidthHz = lerp(track.bandwidthHz, candidate.bandwidthHz)
  track.peakPowerDbfs = lerp(track.peakPowerDbfs, candidate.peakPowerDbfs)
  track.snrDb = lerp(track.snrDb, candidate.snrDb)
  track.edgeClipped = candidate.edgeClipped
  track.captureBandwidthHz = candidate.captureBandwidthHz
  track.binWidthHz = candidate.binWidthHz

  if (candidate.absoluteFrequencyHz !== null && track.absoluteFrequencyHz !== null) {
    track.absoluteFrequencyHz = lerp(track.absoluteFrequencyHz, candidate.absoluteFrequencyHz)
    track.lowerFrequencyHz = lerp(track.lowerFrequencyHz!, candidate.lowerFrequencyHz!)
    track.upperFrequencyHz = lerp(track.upperFrequencyHz!, candidate.upperFrequencyHz!)
    track.peakOffsetHz = track.absoluteFrequencyHz - frame.centerFrequencyHz
    track.lowerOffsetHz = track.lowerFrequencyHz - frame.centerFrequencyHz
    track.upperOffsetHz = track.upperFrequencyHz - frame.centerFrequencyHz
  } else {
    track.peakOffsetHz = lerp(track.peakOffsetHz, candidate.peakOffsetHz)
    track.lowerOffsetHz = lerp(track.lowerOffsetHz, candidate.lowerOffsetHz)
    track.upperOffsetHz = lerp(track.upperOffsetHz, candidate.upperOffsetHz)
  }

  track.lastSeenUs = frame.timestampUs
  track.durationUs =
    track.lastSeenUs >= track.firstSeenUs ? track.lastSeenUs - track.firstSeenUs : 0n
  track.hitCount += 1
  track.missedFrames = 0
  track.state = 'active'
  track.confirmed ||= track.hitCount >= CONFIRMATION_HITS
}

function copyMeasurement(track: MutableTrack): TrackedSignalMeasurement {
  return {
    id: track.id,
    peakOffsetHz: track.peakOffsetHz,
    lowerOffsetHz: track.lowerOffsetHz,
    upperOffsetHz: track.upperOffsetHz,
    absoluteFrequencyHz: track.absoluteFrequencyHz,
    lowerFrequencyHz: track.lowerFrequencyHz,
    upperFrequencyHz: track.upperFrequencyHz,
    bandwidthHz: track.bandwidthHz,
    peakPowerDbfs: track.peakPowerDbfs,
    snrDb: track.snrDb,
    edgeClipped: track.edgeClipped,
    firstSeenUs: track.firstSeenUs,
    lastSeenUs: track.lastSeenUs,
    durationUs: track.durationUs,
    hitCount: track.hitCount,
    state: track.state,
    captureBandwidthHz: track.captureBandwidthHz,
    binWidthHz: track.binWidthHz,
  }
}

function lerp(previous: number, next: number): number {
  return previous + (next - previous) * SMOOTHING
}

function stateRank(state: TrackedSignalMeasurement['state']): number {
  return state === 'active' ? 0 : 1
}

function canAssociate(
  track: MutableTrack,
  candidate: Candidate,
  frame: SignalTrackerFrame,
): boolean {
  if ((track.absoluteFrequencyHz === null) !== (candidate.absoluteFrequencyHz === null)) {
    return false
  }
  const trackLower = track.lowerFrequencyHz ?? track.lowerOffsetHz
  const trackUpper = track.upperFrequencyHz ?? track.upperOffsetHz
  const candidateLower = candidate.lowerFrequencyHz ?? candidate.lowerOffsetHz
  const candidateUpper = candidate.upperFrequencyHz ?? candidate.upperOffsetHz
  const binToleranceHz = Math.max(frame.binWidthHz, track.binWidthHz)
  const overlaps =
    candidateLower <= trackUpper + binToleranceHz &&
    candidateUpper >= trackLower - binToleranceHz
  if (overlaps) return true

  const shakeToleranceHz = Math.min(
    MAX_RF_SHAKE_HZ,
    Math.max(
      frame.sampleRateHz * RF_SHAKE_CAPTURE_FRACTION,
      binToleranceHz * MIN_RF_SHAKE_BINS,
    ),
  )
  return associationDistance(track, candidate) <= shakeToleranceHz
}

function associationDistance(track: MutableTrack, candidate: Candidate): number {
  const trackPeak = track.absoluteFrequencyHz ?? track.peakOffsetHz
  const candidatePeak = candidate.absoluteFrequencyHz ?? candidate.peakOffsetHz
  return Math.abs(candidatePeak - trackPeak)
}