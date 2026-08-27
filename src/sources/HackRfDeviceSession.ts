import {
  HACKRF_MODE,
  HACKRF_REQUEST,
  HackRfIqBlockAssembler,
  hackRfBasebandFilterForSampleRate,
  normalizeHackRfIq,
  packHackRfFrequency,
  packHackRfSampleRate,
  resolveHackRfStreamingInterface,
  splitUint32,
  validateHackRfConfig,
  type HackRfConfig,
} from './hackrfProtocol'
import type {
  UsbControlTransferParameters,
  UsbDevice,
  UsbTransferStatus,
} from './webUsb'

const TRANSFER_SIZE_BYTES = 16 * 1024
const MODE_SETTLE_DELAY_MS = 30
const MAX_CONSECUTIVE_TRANSFER_FAILURES = 3

export type HackRfDeviceInfo = {
  productName: string
  serialNumber: string | null
  firmwareVersion: string | null
  boardId: number | null
  usbApiVersion: string
}

export type HackRfSampleBlock = {
  iq: Float32Array
  sourceSequence: number
  timestampUs: bigint
}

export type HackRfRawSampleBlock = {
  iq: Int8Array
  sourceSequence: number
  timestampUs: bigint
}

type SessionCallbacks = {
  onConfigured?: (info: HackRfDeviceInfo) => void
  onRawSamples?: (block: HackRfRawSampleBlock) => void
  onDiscontinuity?: () => void
  onSamples: (block: HackRfSampleBlock) => void
}

export class HackRfDeviceSession {
  readonly #assembler: HackRfIqBlockAssembler
  readonly #device: UsbDevice
  readonly #config: HackRfConfig
  readonly #callbacks: SessionCallbacks
  #running = false
  #stopping = false
  #claimedInterface: number | undefined
  #inEndpointNumber = 1
  #outputBuffer: ArrayBuffer | undefined
  #shutdown: Promise<void> | undefined
  #sourceSequence = 0
  #elapsedSamples = 0n
  #nextEmissionSample = 0n
  #rawSequence = 0
  #receivedSamples = 0n

  constructor(device: UsbDevice, config: HackRfConfig, callbacks: SessionCallbacks) {
    validateHackRfConfig(config)
    this.#device = device
    this.#config = config
    this.#callbacks = callbacks
    this.#assembler = new HackRfIqBlockAssembler(config.fftSize)
    this.#outputBuffer = new ArrayBuffer(
      config.fftSize * 2 * Float32Array.BYTES_PER_ELEMENT,
    )
  }

  async start(): Promise<void> {
    if (this.#running) throw new Error('HackRF session is already running.')
    this.#running = true
    this.#stopping = false
    try {
      await this.#openAndConfigure()
      while (this.#running && this.#device.opened) {
        await this.#readTransfer()
      }
      if (this.#running && !this.#stopping) {
        throw new Error('HackRF disconnected while receiving.')
      }
    } catch (error) {
      if (!this.#stopping) throw error
    } finally {
      this.#running = false
      await this.#shutdownDevice()
    }
  }

  async stop(): Promise<void> {
    this.#stopping = true
    this.#running = false
    await this.#shutdownDevice()
  }

  returnBuffer(buffer: ArrayBuffer): void {
    const expected = this.#config.fftSize * 2 * Float32Array.BYTES_PER_ELEMENT
    if (buffer.byteLength !== expected) {
      throw new Error(`Returned HackRF IQ buffer is ${buffer.byteLength} bytes; expected ${expected}.`)
    }
    if (this.#outputBuffer) {
      throw new Error('HackRF IQ output buffer was returned more than once.')
    }
    this.#outputBuffer = buffer
  }

  async #openAndConfigure(): Promise<void> {
    if (!this.#device.opened) await this.#device.open()
    this.#assertSetupActive()
    if (!this.#device.configuration || this.#device.configuration.configurationValue !== 1) {
      await this.#device.selectConfiguration(1)
      this.#assertSetupActive()
    }
    const configuration = this.#device.configuration
    if (!configuration) throw new Error('HackRF USB configuration 1 is unavailable.')

    const streamingInterface = resolveHackRfStreamingInterface(configuration)
    await this.#device.claimInterface(streamingInterface.interfaceNumber)
    this.#claimedInterface = streamingInterface.interfaceNumber
    this.#inEndpointNumber = streamingInterface.endpointNumber
    this.#assertSetupActive()
    const currentAlternate = configuration.interfaces.find(
      (deviceInterface) => deviceInterface.interfaceNumber === streamingInterface.interfaceNumber,
    )?.alternate.alternateSetting
    if (currentAlternate !== streamingInterface.alternateSetting) {
      await this.#device.selectAlternateInterface(
        streamingInterface.interfaceNumber,
        streamingInterface.alternateSetting,
      )
      this.#assertSetupActive()
    }

    const probe = await this.#probeDevice()
    this.#assertSetupActive()
    await this.#controlOut(HACKRF_REQUEST.setTransceiverMode, HACKRF_MODE.off)
    this.#assertSetupActive()
    await new Promise<void>((resolve) => setTimeout(resolve, MODE_SETTLE_DELAY_MS))
    this.#assertSetupActive()
    await this.#controlOut(HACKRF_REQUEST.setAntennaEnable, 0)
    this.#assertSetupActive()
    await this.#controlOut(HACKRF_REQUEST.setAmpEnable, 0)
    this.#assertSetupActive()
    await this.#controlOut(
      HACKRF_REQUEST.setSampleRate,
      0,
      0,
      packHackRfSampleRate(this.#config.sampleRateHz),
    )
    this.#assertSetupActive()
    const filter = splitUint32(
      hackRfBasebandFilterForSampleRate(this.#config.sampleRateHz),
    )
    await this.#controlOut(
      HACKRF_REQUEST.setBasebandFilterBandwidth,
      filter.value,
      filter.index,
    )
    this.#assertSetupActive()
    await this.#controlOut(
      HACKRF_REQUEST.setFrequency,
      0,
      0,
      packHackRfFrequency(this.#config.centerFrequencyHz),
    )
    this.#assertSetupActive()
    await this.#setGain(HACKRF_REQUEST.setLnaGain, this.#config.lnaGainDb, 'LNA')
    this.#assertSetupActive()
    await this.#setGain(HACKRF_REQUEST.setVgaGain, this.#config.vgaGainDb, 'VGA')
    this.#assertSetupActive()
    if (this.#config.ampEnabled) {
      await this.#controlOut(HACKRF_REQUEST.setAmpEnable, 1)
      this.#assertSetupActive()
    }
    await this.#controlOut(HACKRF_REQUEST.setTransceiverMode, HACKRF_MODE.receive)
    this.#assertSetupActive()
    this.#callbacks.onConfigured?.(probe)
  }

  #assertSetupActive(): void {
    if (!this.#running || this.#stopping) {
      throw new Error('HackRF setup was canceled.')
    }
  }

  async #probeDevice(): Promise<HackRfDeviceInfo> {
    let boardId: number | null = null
    let firmwareVersion: string | null = null
    try {
      const board = await this.#controlIn(HACKRF_REQUEST.readBoardId, 1)
      boardId = board.getUint8(0)
      const version = await this.#controlIn(HACKRF_REQUEST.readVersionString, 64)
      firmwareVersion = new TextDecoder()
        .decode(new Uint8Array(version.buffer, version.byteOffset, version.byteLength))
        .replace(/\0.*$/s, '')
    } catch {
      // Identification is diagnostic only; RX setup below remains authoritative.
    }
    const major = this.#device.deviceVersionMajor ?? 0
    const minor = this.#device.deviceVersionMinor ?? 0
    const subminor = this.#device.deviceVersionSubminor ?? 0
    return {
      productName: this.#device.productName ?? 'HackRF One',
      serialNumber: this.#device.serialNumber ?? null,
      firmwareVersion,
      boardId,
      usbApiVersion: `${major}.${minor}${subminor}`,
    }
  }

  async #readTransfer(): Promise<void> {
    let consecutiveFailures = 0
    while (this.#running && this.#device.opened) {
      try {
        const result = await this.#device.transferIn(
          this.#inEndpointNumber,
          TRANSFER_SIZE_BYTES,
        )
        if (!this.#running) return
        if (result.status === 'stall') {
          this.#callbacks.onDiscontinuity?.()
          await this.#device.clearHalt('in', this.#inEndpointNumber)
          consecutiveFailures += 1
          if (consecutiveFailures >= MAX_CONSECUTIVE_TRANSFER_FAILURES) {
            throw new Error('HackRF bulk-IN endpoint repeatedly stalled.')
          }
          continue
        }
        this.#assertTransferStatus(result.status, 'bulk-IN')
        if (!result.data?.byteLength) throw new Error('HackRF returned an empty IQ transfer.')
        if (result.data.byteLength % 2 !== 0) {
          throw new Error('HackRF returned an incomplete interleaved I/Q pair.')
        }
        const rawIq = new Int8Array(
          result.data.buffer,
          result.data.byteOffset,
          result.data.byteLength,
        )
        const rawStart = this.#receivedSamples
        this.#receivedSamples += BigInt(rawIq.length / 2)
        this.#rawSequence = (this.#rawSequence + 1) >>> 0
        this.#callbacks.onRawSamples?.({
          iq: rawIq,
          sourceSequence: this.#rawSequence,
          timestampUs:
            (rawStart * 1_000_000n) / BigInt(this.#config.sampleRateHz),
        })
        this.#assembler.push(result.data, (rawBlock) => this.#handleRawBlock(rawBlock))
        return
      } catch (error) {
        if (this.#stopping || !this.#running) return
        this.#callbacks.onDiscontinuity?.()
        consecutiveFailures += 1
        if (consecutiveFailures >= MAX_CONSECUTIVE_TRANSFER_FAILURES) throw error
      }
    }
  }

  #handleRawBlock(rawBlock: Int8Array): void {
    const blockStart = this.#elapsedSamples
    this.#elapsedSamples += BigInt(this.#config.fftSize)
    this.#sourceSequence = (this.#sourceSequence + 1) >>> 0
    if (!this.#outputBuffer || blockStart < this.#nextEmissionSample) return

    const output = new Float32Array(this.#outputBuffer)
    normalizeHackRfIq(rawBlock, output)
    this.#outputBuffer = undefined
    this.#nextEmissionSample =
      blockStart + BigInt(Math.max(1, Math.round(this.#config.sampleRateHz / this.#config.frameRate)))
    this.#callbacks.onSamples({
      iq: output,
      sourceSequence: this.#sourceSequence,
      timestampUs: (blockStart * 1_000_000n) / BigInt(this.#config.sampleRateHz),
    })
  }

  async #setGain(request: number, gainDb: number, label: string): Promise<void> {
    const response = await this.#controlIn(request, 1, 0, gainDb)
    if (response.getUint8(0) === 0) throw new Error(`HackRF rejected ${label} gain ${gainDb} dB.`)
  }

  async #controlIn(
    request: number,
    length: number,
    value = 0,
    index = 0,
  ): Promise<DataView> {
    const result = await this.#device.controlTransferIn(
      this.#controlParameters(request, value, index),
      length,
    )
    this.#assertTransferStatus(result.status, `control-IN request ${request}`)
    if (!result.data || result.data.byteLength < length) {
      throw new Error(`HackRF control-IN request ${request} returned a short response.`)
    }
    return result.data
  }

  async #controlOut(
    request: number,
    value = 0,
    index = 0,
    data?: BufferSource,
  ): Promise<void> {
    const result = await this.#device.controlTransferOut(
      this.#controlParameters(request, value, index),
      data,
    )
    this.#assertTransferStatus(result.status, `control-OUT request ${request}`)
    const expectedBytes = data ? data.byteLength : 0
    if (result.bytesWritten !== undefined && result.bytesWritten !== expectedBytes) {
      throw new Error(
        `HackRF control-OUT request ${request} wrote ${result.bytesWritten} of ${expectedBytes} bytes.`,
      )
    }
  }

  #controlParameters(
    request: number,
    value: number,
    index: number,
  ): UsbControlTransferParameters {
    return { requestType: 'vendor', recipient: 'device', request, value, index }
  }

  #assertTransferStatus(status: UsbTransferStatus, operation: string): void {
    if (status !== 'ok') throw new Error(`HackRF ${operation} failed with status ${status}.`)
  }

  #shutdownDevice(): Promise<void> {
    if (!this.#shutdown) {
      this.#shutdown = this.#performShutdown()
      const shutdown = this.#shutdown
      void shutdown.then(
        () => {
          if (this.#shutdown === shutdown) this.#shutdown = undefined
        },
        () => {
          if (this.#shutdown === shutdown) this.#shutdown = undefined
        },
      )
    }
    return this.#shutdown
  }

  async #performShutdown(): Promise<void> {
    if (this.#device.opened) {
      try {
        await this.#controlOut(HACKRF_REQUEST.setTransceiverMode, HACKRF_MODE.off)
      } catch {
        // Continue cleanup when the device has already disconnected.
      }
    }
    if (this.#claimedInterface !== undefined && this.#device.opened) {
      try {
        await this.#device.releaseInterface(this.#claimedInterface)
      } catch {
        // close() also releases claimed interfaces.
      }
    }
    if (this.#device.opened) {
      try {
        await this.#device.close()
      } catch {
        // A disconnected device is already closed from the app's perspective.
      }
    }
    this.#claimedInterface = undefined
  }
}
