import type {
  VfoAudioBlock,
  VfoMixerControl,
  VfoMixerDiagnostics,
} from '../vfo/types'
import type { SourceSessionId } from '../sources/types'

type QueueChunk = {
  samples: Float32Array
  channelCount: 1 | 2
  frameOffset: number
}

type VfoQueue = {
  revision: number
  chunks: QueueChunk[]
  queuedFrames: number
  playbackRate: number
  rateAdjustmentFrames: number
  scratchLeft: Float32Array
  scratchRight: Float32Array
  stereoLocked: boolean
  ready: boolean
  starved: boolean
  underruns: number
  overruns: number
}

export type VfoMixerOptions = {
  sampleRateHz: number
  prebufferMs?: number
  maximumQueueMs?: number
  limiterCeilingDb?: number
}

export class VfoMixerCore {
  readonly #sampleRateHz: number
  readonly #prebufferFrames: number
  readonly #targetQueueFrames: number
  readonly #maximumQueueFrames: number
  readonly #limiterCeiling: number
  readonly #queues = new Map<string, VfoQueue>()
  readonly #controls = new Map<string, VfoMixerControl>()
  #masterGain = 1
  #masterMuted = false
  #limiterGain = 1
  #staleBlocks = 0
  readonly #staleBlocksBySource = new Map<SourceSessionId, number>()

  constructor({
    sampleRateHz,
    prebufferMs = 100,
    maximumQueueMs = 250,
    limiterCeilingDb = -1,
  }: VfoMixerOptions) {
    if (!Number.isFinite(sampleRateHz) || sampleRateHz <= 0) {
      throw new Error('Mixer sample rate must be greater than zero.')
    }
    if (prebufferMs < 0 || maximumQueueMs <= 0 || prebufferMs > maximumQueueMs) {
      throw new Error('Mixer queue durations are invalid.')
    }
    this.#sampleRateHz = sampleRateHz
    this.#prebufferFrames = Math.round(sampleRateHz * prebufferMs / 1000)
    this.#maximumQueueFrames = Math.round(sampleRateHz * maximumQueueMs / 1000)
    this.#targetQueueFrames = Math.round(
      (this.#prebufferFrames + this.#maximumQueueFrames) / 2,
    )
    this.#limiterCeiling = dbToGain(limiterCeilingDb)
  }

  configure(vfos: readonly VfoMixerControl[], masterGainDb: number, masterMuted: boolean): void {
    const activeIds = new Set(vfos.map((vfo) => vfo.id))
    for (const id of this.#controls.keys()) {
      if (!activeIds.has(id)) {
        this.#controls.delete(id)
        this.#queues.delete(id)
      }
    }
    for (const vfo of vfos) {
      const previous = this.#controls.get(vfo.id)
      this.#controls.set(vfo.id, { ...vfo })
      if (previous && previous.revision !== vfo.revision) this.flush(vfo.id)
    }
    this.#masterGain = dbToGain(masterGainDb)
    this.#masterMuted = masterMuted
  }

  push(sourceSessionId: SourceSessionId, block: VfoAudioBlock): void {
    const control = this.#controls.get(block.vfoId)
    if (
      !control ||
      control.sourceSessionId !== sourceSessionId ||
      !control.active ||
      block.revision !== control.revision
    ) {
      this.#recordStaleBlock(sourceSessionId)
      return
    }
    if (block.sampleRateHz !== this.#sampleRateHz) {
      throw new Error(
        `VFO ${block.vfoId} audio rate ${block.sampleRateHz} does not match ${this.#sampleRateHz}.`,
      )
    }
    if (block.samples.length % block.channelCount !== 0) {
      throw new Error(`VFO ${block.vfoId} audio block has incomplete frames.`)
    }

    const frameCount = block.samples.length / block.channelCount
    let queue = this.#queues.get(block.vfoId)
    if (!queue || queue.revision !== block.revision) {
      queue = createQueue(block.revision)
      this.#queues.set(block.vfoId, queue)
    }
    queue.chunks.push({
      samples: block.samples,
      channelCount: block.channelCount,
      frameOffset: 0,
    })
    queue.queuedFrames += frameCount
    queue.stereoLocked = block.stereoLocked
    if (queue.queuedFrames > this.#maximumQueueFrames) {
      dropFrames(queue, queue.queuedFrames - this.#maximumQueueFrames)
      queue.overruns += 1
    }
    if (queue.queuedFrames >= this.#prebufferFrames) queue.ready = true
  }

  render(left: Float32Array, right: Float32Array): void {
    if (left.length !== right.length) {
      throw new Error('Mixer output channels must have equal lengths.')
    }
    left.fill(0)
    right.fill(0)
    const soloActive = [...this.#controls.values()].some(
      (control) => control.active && control.solo && !control.muted,
    )

    for (const control of this.#controls.values()) {
      const queue = this.#queues.get(control.id)
      if (!control.active || control.muted || (soloActive && !control.solo)) {
        if (queue) {
          dropFrames(queue, queue.queuedFrames)
          resetQueueRate(queue)
        }
        continue
      }
      if (!queue?.ready || queue.queuedFrames < left.length) {
        if (queue?.ready && !queue.starved) {
          queue.starved = true
          queue.underruns += 1
        }
        continue
      }
      queue.starved = false
      mixQueue(
        queue,
        left,
        right,
        dbToGain(control.gainDb),
        this.#targetQueueFrames,
      )
    }

    const masterGain = this.#masterMuted ? 0 : this.#masterGain
    for (let index = 0; index < left.length; index += 1) {
      const peak = Math.max(Math.abs(left[index] * masterGain), Math.abs(right[index] * masterGain))
      const targetGain = peak > this.#limiterCeiling ? this.#limiterCeiling / peak : 1
      if (targetGain < this.#limiterGain) this.#limiterGain = targetGain
      else this.#limiterGain += 0.002 * (targetGain - this.#limiterGain)
      left[index] *= masterGain * this.#limiterGain
      right[index] *= masterGain * this.#limiterGain
    }
  }

  flush(id?: string): void {
    if (id !== undefined) {
      this.#queues.delete(id)
      return
    }
    this.#queues.clear()
    this.#limiterGain = 1
  }

  flushSource(sourceSessionId: SourceSessionId): void {
    for (const control of this.#controls.values()) {
      if (control.sourceSessionId === sourceSessionId) this.#queues.delete(control.id)
    }
  }

  diagnostics(): VfoMixerDiagnostics {
    const queuedFrames: Record<string, number> = {}
    const underruns: Record<string, number> = {}
    const overruns: Record<string, number> = {}
    const stereoLocked: Record<string, boolean> = {}
    const staleBlocksBySource: Record<SourceSessionId, number> = {}
    for (const [id, queue] of this.#queues) {
      queuedFrames[id] = queue.queuedFrames
      underruns[id] = queue.underruns
      overruns[id] = queue.overruns
      stereoLocked[id] = queue.stereoLocked
    }
    for (const [sourceSessionId, count] of this.#staleBlocksBySource) {
      staleBlocksBySource[sourceSessionId] = count
    }
    return {
      queuedFrames,
      underruns,
      overruns,
      stereoLocked,
      staleBlocks: this.#staleBlocks,
      staleBlocksBySource,
      limiterReductionDb: 20 * Math.log10(this.#limiterGain),
    }
  }

  #recordStaleBlock(sourceSessionId: SourceSessionId): void {
    this.#staleBlocks += 1
    this.#staleBlocksBySource.set(
      sourceSessionId,
      (this.#staleBlocksBySource.get(sourceSessionId) ?? 0) + 1,
    )
  }
}

function createQueue(revision: number): VfoQueue {
  return {
    revision,
    chunks: [],
    queuedFrames: 0,
    playbackRate: 1,
    rateAdjustmentFrames: 0,
    scratchLeft: new Float32Array(0),
    scratchRight: new Float32Array(0),
    stereoLocked: false,
    ready: false,
    starved: false,
    underruns: 0,
    overruns: 0,
  }
}

function dropFrames(queue: VfoQueue, requestedFrames: number): void {
  let remaining = requestedFrames
  while (remaining > 0 && queue.chunks.length > 0) {
    const chunk = queue.chunks[0]
    const available = chunk.samples.length / chunk.channelCount - chunk.frameOffset
    const consumed = Math.min(available, remaining)
    chunk.frameOffset += consumed
    queue.queuedFrames -= consumed
    remaining -= consumed
    if (chunk.frameOffset === chunk.samples.length / chunk.channelCount) queue.chunks.shift()
  }
}

function mixQueue(
  queue: VfoQueue,
  left: Float32Array,
  right: Float32Array,
  gain: number,
  targetQueueFrames: number,
): void {
  const sourceFrameCount = correctedSourceFrameCount(
    queue,
    left.length,
    targetQueueFrames,
  )
  if (sourceFrameCount === left.length) {
    mixQueueExact(queue, left, right, gain)
    return
  }

  ensureScratchCapacity(queue, left.length + 1)
  drainQueue(
    queue,
    sourceFrameCount,
    queue.scratchLeft,
    queue.scratchRight,
  )
  const sourceSpan = sourceFrameCount - 1
  const outputSpan = Math.max(1, left.length - 1)
  for (let frame = 0; frame < left.length; frame += 1) {
    const sourcePosition = frame * sourceSpan / outputSpan
    const lower = Math.floor(sourcePosition)
    const upper = Math.min(sourceFrameCount - 1, lower + 1)
    const fraction = sourcePosition - lower
    const leftSample = queue.scratchLeft[lower] +
      (queue.scratchLeft[upper] - queue.scratchLeft[lower]) * fraction
    const rightSample = queue.scratchRight[lower] +
      (queue.scratchRight[upper] - queue.scratchRight[lower]) * fraction
    left[frame] += leftSample * gain
    right[frame] += rightSample * gain
  }
}

function correctedSourceFrameCount(
  queue: VfoQueue,
  outputFrameCount: number,
  targetQueueFrames: number,
): number {
  if (outputFrameCount <= 1 || targetQueueFrames <= 0) return outputFrameCount
  const queueError = (queue.queuedFrames - targetQueueFrames) / targetQueueFrames
  const targetRate = clamp(1 + queueError * 0.02, 0.995, 1.005)
  queue.playbackRate += (targetRate - queue.playbackRate) * 0.05
  queue.rateAdjustmentFrames += (queue.playbackRate - 1) * outputFrameCount
  if (queue.rateAdjustmentFrames >= 1 && queue.queuedFrames > outputFrameCount) {
    queue.rateAdjustmentFrames -= 1
    return outputFrameCount + 1
  }
  if (queue.rateAdjustmentFrames <= -1) {
    queue.rateAdjustmentFrames += 1
    return outputFrameCount - 1
  }
  return outputFrameCount
}

function mixQueueExact(
  queue: VfoQueue,
  left: Float32Array,
  right: Float32Array,
  gain: number,
): void {
  let outputOffset = 0
  while (outputOffset < left.length) {
    const chunk = queue.chunks[0]
    if (!chunk) break
    const available = chunk.samples.length / chunk.channelCount - chunk.frameOffset
    const consumed = Math.min(available, left.length - outputOffset)
    for (let frame = 0; frame < consumed; frame += 1) {
      const sampleOffset = (chunk.frameOffset + frame) * chunk.channelCount
      const leftSample = chunk.samples[sampleOffset]
      const rightSample = chunk.channelCount === 2 ? chunk.samples[sampleOffset + 1] : leftSample
      left[outputOffset + frame] += leftSample * gain
      right[outputOffset + frame] += rightSample * gain
    }
    chunk.frameOffset += consumed
    queue.queuedFrames -= consumed
    outputOffset += consumed
    if (chunk.frameOffset === chunk.samples.length / chunk.channelCount) queue.chunks.shift()
  }
}

function ensureScratchCapacity(queue: VfoQueue, frameCount: number): void {
  if (queue.scratchLeft.length >= frameCount) return
  queue.scratchLeft = new Float32Array(frameCount)
  queue.scratchRight = new Float32Array(frameCount)
}

function drainQueue(
  queue: VfoQueue,
  frameCount: number,
  left: Float32Array,
  right: Float32Array,
): void {
  let outputOffset = 0
  while (outputOffset < frameCount) {
    const chunk = queue.chunks[0]
    if (!chunk) break
    const available = chunk.samples.length / chunk.channelCount - chunk.frameOffset
    const consumed = Math.min(available, frameCount - outputOffset)
    for (let frame = 0; frame < consumed; frame += 1) {
      const sampleOffset = (chunk.frameOffset + frame) * chunk.channelCount
      const leftSample = chunk.samples[sampleOffset]
      left[outputOffset + frame] = leftSample
      right[outputOffset + frame] = chunk.channelCount === 2
        ? chunk.samples[sampleOffset + 1]
        : leftSample
    }
    chunk.frameOffset += consumed
    queue.queuedFrames -= consumed
    outputOffset += consumed
    if (chunk.frameOffset === chunk.samples.length / chunk.channelCount) queue.chunks.shift()
  }
}

function resetQueueRate(queue: VfoQueue): void {
  queue.playbackRate = 1
  queue.rateAdjustmentFrames = 0
  queue.ready = false
  queue.starved = false
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function dbToGain(db: number): number {
  return 10 ** (db / 20)
}