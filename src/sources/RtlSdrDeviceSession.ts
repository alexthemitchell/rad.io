import {
  DirectSampling,
  type RtlDevice,
  type SampleBlock,
} from '@jtarrio/webrtlsdr/rtlsdr.js'
import {
  configWithRtlSdrRuntimeCommand,
  validateRtlSdrConfig,
  type RtlSdrConfig,
  type RtlSdrRuntimeCommand,
} from './rtlSdrProtocol'
import {
  convertUnsignedIqToSignedInPlace,
  InterleavedIqBlockAssembler,
  normalizeSignedIq,
  removeComplexDcOffset,
} from './iqPipeline'

const READ_SIZE_SAMPLES = 65_536
const READ_PIPELINE_DEPTH = 2
const RETUNE_SETTLE_TIME_MS = 50
const MAX_CONSECUTIVE_READ_FAILURES = 3

export type RtlSdrDeviceInfo = {
  productName: string
  serialNumber: string | null
  tunerType: 'E4000'
  actualSampleRateHz: number
  actualCenterFrequencyHz: number
}

export type RtlSdrSampleBlock = {
  iq: Float32Array
  sampleRateHz: number
  centerFrequencyHz: number
  sourceSequence: number
  timestampUs: bigint
}

export type RtlSdrRawSampleBlock = {
  iq: Int8Array
  sourceSequence: number
  timestampUs: bigint
}

type RtlSdrSessionCallbacks = {
  onConfigured?: (info: RtlSdrDeviceInfo) => void
  onRawSamples?: (block: RtlSdrRawSampleBlock) => void
  onDiscontinuity?: () => void
  onSamples: (block: RtlSdrSampleBlock) => void
}

type RtlSdrSessionIdentity = {
  productName?: string | null
  serialNumber?: string | null
}

type PendingRead = {
  generation: number
  promise: Promise<SampleBlock>
}

export class RtlSdrDeviceSession {
  readonly #assembler: InterleavedIqBlockAssembler
  readonly #device: RtlDevice
  readonly #callbacks: RtlSdrSessionCallbacks
  readonly #identity: RtlSdrSessionIdentity
  #config: RtlSdrConfig
  #actualSampleRateHz: number
  #actualCenterFrequencyHz: number
  #running = false
  #stopping = false
  #reconfiguring = false
  #captureGeneration = 0
  #outputBuffer: ArrayBuffer | undefined
  #shutdown: Promise<void> | undefined
  #sourceSequence = 0
  #rawSequence = 0
  #elapsedSamples = 0n
  #receivedSamples = 0n
  #nextEmissionSample = 0n
  #discardSamplesRemaining = 0n
  #consecutiveReadFailures = 0
  readonly #pendingReads: PendingRead[] = []
  #activeRead: PendingRead | undefined
  #readDrain: Promise<void> | undefined
  #readsPaused: Promise<void> | undefined
  #resumeReads: (() => void) | undefined
  #runtimeCommandQueue: Promise<void> = Promise.resolve()

  constructor(
    device: RtlDevice,
    config: RtlSdrConfig,
    callbacks: RtlSdrSessionCallbacks,
    identity: RtlSdrSessionIdentity = {},
  ) {
    validateRtlSdrConfig(config)
    this.#device = device
    this.#config = { ...config }
    this.#callbacks = callbacks
    this.#identity = identity
    this.#actualSampleRateHz = config.sampleRateHz
    this.#actualCenterFrequencyHz = config.centerFrequencyHz
    this.#assembler = new InterleavedIqBlockAssembler(config.fftSize)
    this.#outputBuffer = new ArrayBuffer(
      config.fftSize * 2 * Float32Array.BYTES_PER_ELEMENT,
    )
  }

  async start(): Promise<void> {
    if (this.#running) throw new Error('RTL-SDR session is already running.')
    this.#running = true
    this.#stopping = false
    try {
      await this.#configureDevice()
      while (this.#running) {
        if (this.#readsPaused) await this.#readsPaused
        if (this.#running) await this.#readNextBlock()
      }
      if (!this.#stopping) throw new Error('RTL-SDR disconnected while receiving.')
    } catch (error) {
      if (!this.#stopping) throw error
    } finally {
      this.#running = false
      await this.#shutdownDevice()
      await this.#drainReads()
    }
  }

  async stop(): Promise<void> {
    this.#stopping = true
    this.#running = false
    this.#captureGeneration += 1
    this.#resumeReadLoop()
    await this.#shutdownDevice()
    await this.#drainReads()
  }

  returnBuffer(buffer: ArrayBuffer): void {
    const expected = this.#config.fftSize * 2 * Float32Array.BYTES_PER_ELEMENT
    if (buffer.byteLength !== expected) {
      throw new Error(`Returned RTL-SDR IQ buffer is ${buffer.byteLength} bytes; expected ${expected}.`)
    }
    if (this.#outputBuffer) throw new Error('RTL-SDR IQ output buffer was returned more than once.')
    this.#outputBuffer = buffer
  }

  applyRuntimeCommand(command: RtlSdrRuntimeCommand): Promise<RtlSdrConfig> {
    const result = this.#runtimeCommandQueue.then(() => this.#applyRuntimeCommand(command))
    this.#runtimeCommandQueue = result.then(
      () => undefined,
      () => undefined,
    )
    return result
  }

  async #configureDevice(): Promise<void> {
    await this.#device.enableBiasTee(false)
    this.#actualSampleRateHz = await this.#device.setSampleRate(this.#config.sampleRateHz)
    await this.#device.setFrequencyCorrection(this.#config.frequencyCorrectionPpm)
    await this.#device.setDirectSamplingMethod(toDeviceDirectSampling(this.#config.directSampling))
    await this.#device.setGain(this.#config.tunerGainDb)
    this.#actualCenterFrequencyHz = await this.#device.setCenterFrequency(
      this.#config.centerFrequencyHz,
    )
    if (this.#config.biasTeeEnabled) await this.#device.enableBiasTee(true)
    await this.#device.resetBuffer()
    this.#callbacks.onConfigured?.({
      productName: this.#identity.productName ?? 'RTL-SDR',
      serialNumber: this.#identity.serialNumber ?? null,
      tunerType: 'E4000',
      actualSampleRateHz: this.#actualSampleRateHz,
      actualCenterFrequencyHz: this.#actualCenterFrequencyHz,
    })
  }

  async #readNextBlock(): Promise<void> {
    this.#fillReadPipeline()
    const read = this.#pendingReads.shift()
    if (!read) return
    this.#activeRead = read
    let block: SampleBlock
    try {
      block = await read.promise
    } catch (error) {
      if (!this.#running || this.#stopping) return
      if (read.generation !== this.#captureGeneration || this.#reconfiguring) return
      this.#consecutiveReadFailures += 1
      this.#assembler.reset()
      this.#callbacks.onDiscontinuity?.()
      if (this.#consecutiveReadFailures >= MAX_CONSECUTIVE_READ_FAILURES) throw error
      this.#fillReadPipeline()
      return
    } finally {
      if (this.#activeRead === read) this.#activeRead = undefined
    }
    if (!this.#running) return
    this.#consecutiveReadFailures = 0
    if (block.data.byteLength === 0 || block.data.byteLength % 2 !== 0) {
      throw new Error('RTL-SDR returned an incomplete interleaved I/Q block.')
    }

    const sampleCount = BigInt(block.data.byteLength / 2)
    const rawStart = this.#receivedSamples
    this.#receivedSamples += sampleCount
    if (read.generation !== this.#captureGeneration || this.#reconfiguring) {
      this.#assembler.reset()
      this.#elapsedSamples += sampleCount
      this.#fillReadPipeline()
      return
    }
    if (this.#discardSamplesRemaining > 0n) {
      this.#discardSamplesRemaining = this.#discardSamplesRemaining > sampleCount
        ? this.#discardSamplesRemaining - sampleCount
        : 0n
      this.#assembler.reset()
      this.#elapsedSamples += sampleCount
      this.#fillReadPipeline()
      return
    }

    this.#fillReadPipeline()
    const signedIq = convertUnsignedIqToSignedInPlace(new Uint8Array(block.data))
    this.#rawSequence = (this.#rawSequence + 1) >>> 0
    this.#assembler.push(signedIq, (rawBlock) => this.#handleRawBlock(rawBlock))
    this.#callbacks.onRawSamples?.({
      iq: signedIq,
      sourceSequence: this.#rawSequence,
      timestampUs: rawStart * 1_000_000n / BigInt(this.#actualSampleRateHz),
    })
  }

  #fillReadPipeline(): void {
    while (
      this.#running &&
      !this.#reconfiguring &&
      this.#pendingReads.length < READ_PIPELINE_DEPTH
    ) {
      const read = {
        generation: this.#captureGeneration,
        promise: this.#device.readSamples(READ_SIZE_SAMPLES),
      }
      void read.promise.catch(() => undefined)
      this.#pendingReads.push(read)
    }
  }

  #handleRawBlock(rawBlock: Int8Array): void {
    const blockStart = this.#elapsedSamples
    this.#elapsedSamples += BigInt(this.#config.fftSize)
    this.#sourceSequence = (this.#sourceSequence + 1) >>> 0
    if (!this.#outputBuffer || blockStart < this.#nextEmissionSample) return

    const output = new Float32Array(this.#outputBuffer)
    normalizeSignedIq(rawBlock, output)
    removeComplexDcOffset(output)
    this.#outputBuffer = undefined
    this.#nextEmissionSample =
      blockStart + BigInt(Math.max(
        1,
        Math.round(this.#actualSampleRateHz / this.#config.frameRate),
      ))
    this.#callbacks.onSamples({
      iq: output,
      sampleRateHz: this.#actualSampleRateHz,
      centerFrequencyHz: this.#actualCenterFrequencyHz,
      sourceSequence: this.#sourceSequence,
      timestampUs: blockStart * 1_000_000n / BigInt(this.#actualSampleRateHz),
    })
  }

  async #applyRuntimeCommand(command: RtlSdrRuntimeCommand): Promise<RtlSdrConfig> {
    if (!this.#running || this.#stopping) throw new Error('RTL-SDR receiver is not running.')
    const next = configWithRtlSdrRuntimeCommand(this.#config, command)
    const discontinuity = command.type === 'set-center-frequency' ||
      command.type === 'set-frequency-correction' ||
      command.type === 'set-direct-sampling'
    if (discontinuity) {
      this.#reconfiguring = true
      this.#captureGeneration += 1
      this.#pauseReadLoop()
      this.#assembler.reset()
      await this.#drainReads()
      if (!this.#running || this.#stopping) {
        throw new Error('RTL-SDR receiver stopped before applying the setting.')
      }
    }
    try {
      if (command.type === 'set-center-frequency') {
        this.#actualCenterFrequencyHz = await this.#device.setCenterFrequency(
          next.centerFrequencyHz,
        )
      } else if (command.type === 'set-tuner-gain') {
        await this.#device.setGain(next.tunerGainDb)
      } else if (command.type === 'set-frequency-correction') {
        await this.#device.setFrequencyCorrection(next.frequencyCorrectionPpm)
        this.#actualCenterFrequencyHz = await this.#device.setCenterFrequency(
          next.centerFrequencyHz,
        )
      } else if (command.type === 'set-direct-sampling') {
        await this.#device.setDirectSamplingMethod(toDeviceDirectSampling(next.directSampling))
        this.#actualCenterFrequencyHz = await this.#device.setCenterFrequency(
          next.centerFrequencyHz,
        )
      } else {
        await this.#device.enableBiasTee(next.biasTeeEnabled)
      }
      this.#config = next
      if (discontinuity) {
        await this.#device.resetBuffer()
        this.#assembler.reset()
        this.#nextEmissionSample = this.#elapsedSamples
        this.#discardSamplesRemaining = BigInt(
          Math.ceil(this.#actualSampleRateHz * RETUNE_SETTLE_TIME_MS / 1_000),
        )
        this.#callbacks.onDiscontinuity?.()
      }
      return { ...this.#config }
    } finally {
      if (discontinuity) {
        this.#reconfiguring = false
        this.#resumeReadLoop()
        this.#fillReadPipeline()
      }
    }
  }

  #drainReads(): Promise<void> {
    if (!this.#readDrain) {
      const reads = this.#activeRead
        ? [this.#activeRead, ...this.#pendingReads]
        : [...this.#pendingReads]
      this.#pendingReads.length = 0
      const drain = Promise.allSettled(reads.map(({ promise }) => promise)).then(() => undefined)
      this.#readDrain = drain
      void drain.finally(() => {
        if (this.#readDrain === drain) this.#readDrain = undefined
      })
    }
    return this.#readDrain
  }

  #shutdownDevice(): Promise<void> {
    this.#shutdown ??= this.#performShutdown()
    return this.#shutdown
  }

  #pauseReadLoop(): void {
    if (this.#readsPaused) return
    this.#readsPaused = new Promise<void>((resolve) => {
      this.#resumeReads = resolve
    })
  }

  #resumeReadLoop(): void {
    this.#resumeReads?.()
    this.#resumeReads = undefined
    this.#readsPaused = undefined
  }

  async #performShutdown(): Promise<void> {
    try {
      await this.#device.enableBiasTee(false)
    } catch {
      // The receiver may already be disconnected.
    }
    try {
      await this.#device.close()
    } catch {
      // Closing a disconnected receiver is best-effort.
    }
  }
}

export function toDeviceDirectSampling(mode: RtlSdrConfig['directSampling']): DirectSampling {
  if (mode === 'i') return DirectSampling.I
  if (mode === 'q') return DirectSampling.Q
  return DirectSampling.Off
}