import type {
  VfoAudioBlock,
  VfoMixerControl,
  VfoMixerDiagnostics,
} from '../vfo/types'

type QueueChunk = {
  samples: Float32Array
  channelCount: 1 | 2
  frameOffset: number
}

type VfoQueue = {
  revision: number
  chunks: QueueChunk[]
  queuedFrames: number
  ready: boolean
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
  readonly #maximumQueueFrames: number
  readonly #limiterCeiling: number
  readonly #queues = new Map<string, VfoQueue>()
  readonly #controls = new Map<string, VfoMixerControl>()
  #masterGain = 1
  #masterMuted = false
  #limiterGain = 1
  #staleBlocks = 0

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

  push(block: VfoAudioBlock): void {
    const control = this.#controls.get(block.vfoId)
    if (!control || !control.active || block.revision !== control.revision) {
      this.#staleBlocks += 1
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
        if (queue) dropFrames(queue, queue.queuedFrames)
        continue
      }
      if (!queue?.ready || queue.queuedFrames < left.length) {
        if (queue?.ready) {
          queue.ready = false
          queue.underruns += 1
        }
        continue
      }
      mixQueue(queue, left, right, dbToGain(control.gainDb))
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

  diagnostics(): VfoMixerDiagnostics {
    const queuedFrames: Record<string, number> = {}
    const underruns: Record<string, number> = {}
    const overruns: Record<string, number> = {}
    for (const [id, queue] of this.#queues) {
      queuedFrames[id] = queue.queuedFrames
      underruns[id] = queue.underruns
      overruns[id] = queue.overruns
    }
    return {
      queuedFrames,
      underruns,
      overruns,
      staleBlocks: this.#staleBlocks,
      limiterReductionDb: 20 * Math.log10(this.#limiterGain),
    }
  }
}

function createQueue(revision: number): VfoQueue {
  return {
    revision,
    chunks: [],
    queuedFrames: 0,
    ready: false,
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

function dbToGain(db: number): number {
  return 10 ** (db / 20)
}