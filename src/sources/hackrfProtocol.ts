import type { UsbConfiguration } from './webUsb'

export const HACKRF_USB_VENDOR_ID = 0x1d50
export const HACKRF_ONE_USB_PRODUCT_ID = 0x6089

export const HACKRF_REQUEST = {
  setTransceiverMode: 0x01,
  setSampleRate: 0x06,
  setBasebandFilterBandwidth: 0x07,
  readBoardId: 0x0e,
  readVersionString: 0x0f,
  setFrequency: 0x10,
  setAmpEnable: 0x11,
  setLnaGain: 0x13,
  setVgaGain: 0x14,
  setAntennaEnable: 0x17,
} as const

export const HACKRF_MODE = {
  off: 0,
  receive: 1,
} as const

export const HACKRF_SAMPLE_RATES_HZ = [
  2_000_000,
  5_000_000,
  10_000_000,
  20_000_000,
] as const

const HACKRF_BASEBAND_FILTERS_HZ = [
  1_750_000,
  2_500_000,
  3_500_000,
  5_000_000,
  5_500_000,
  6_000_000,
  7_000_000,
  8_000_000,
  9_000_000,
  10_000_000,
  12_000_000,
  14_000_000,
  15_000_000,
  20_000_000,
  24_000_000,
  28_000_000,
] as const

export type HackRfSampleRateHz = (typeof HACKRF_SAMPLE_RATES_HZ)[number]
export type HackRfFftSize = 1024 | 2048 | 4096

export type HackRfConfig = {
  centerFrequencyHz: number
  sampleRateHz: HackRfSampleRateHz
  fftSize: HackRfFftSize
  lnaGainDb: number
  vgaGainDb: number
  ampEnabled: boolean
  frameRate: number
}

export type HackRfRuntimeCommand =
  | { type: 'set-center-frequency'; centerFrequencyHz: number }
  | { type: 'set-lna-gain'; lnaGainDb: number }
  | { type: 'set-vga-gain'; vgaGainDb: number }

export const DEFAULT_HACKRF_CONFIG: HackRfConfig = {
  centerFrequencyHz: 100_000_000,
  sampleRateHz: 2_000_000,
  fftSize: 2048,
  lnaGainDb: 16,
  vgaGainDb: 20,
  ampEnabled: false,
  frameRate: 30,
}

export type HackRfStreamingInterface = {
  interfaceNumber: number
  alternateSetting: number
  endpointNumber: number
}

export function validateHackRfConfig(config: HackRfConfig): void {
  if (
    !Number.isSafeInteger(config.centerFrequencyHz) ||
    config.centerFrequencyHz < 1_000_000 ||
    config.centerFrequencyHz > 6_000_000_000
  ) {
    throw new Error('HackRF center frequency must be an integer from 1 MHz to 6 GHz.')
  }
  if (!(HACKRF_SAMPLE_RATES_HZ as readonly number[]).includes(config.sampleRateHz)) {
    throw new Error(`Unsupported HackRF sample rate ${config.sampleRateHz}.`)
  }
  if (![1024, 2048, 4096].includes(config.fftSize)) {
    throw new Error(`Unsupported FFT size ${config.fftSize}.`)
  }
  if (
    !Number.isInteger(config.lnaGainDb) ||
    config.lnaGainDb < 0 ||
    config.lnaGainDb > 40 ||
    config.lnaGainDb % 8 !== 0
  ) {
    throw new Error('HackRF LNA gain must be from 0 to 40 dB in 8 dB steps.')
  }
  if (
    !Number.isInteger(config.vgaGainDb) ||
    config.vgaGainDb < 0 ||
    config.vgaGainDb > 62 ||
    config.vgaGainDb % 2 !== 0
  ) {
    throw new Error('HackRF VGA gain must be from 0 to 62 dB in 2 dB steps.')
  }
  if (!Number.isFinite(config.frameRate) || config.frameRate < 1 || config.frameRate > 60) {
    throw new Error('HackRF analysis rate must be between 1 and 60 frames per second.')
  }
}

export function configWithHackRfRuntimeCommand(
  config: HackRfConfig,
  command: HackRfRuntimeCommand,
): HackRfConfig {
  const next = command.type === 'set-center-frequency'
    ? { ...config, centerFrequencyHz: command.centerFrequencyHz }
    : command.type === 'set-lna-gain'
      ? { ...config, lnaGainDb: command.lnaGainDb }
      : { ...config, vgaGainDb: command.vgaGainDb }
  validateHackRfConfig(next)
  return next
}

export function packHackRfSampleRate(sampleRateHz: number): ArrayBuffer {
  if (!Number.isSafeInteger(sampleRateHz) || sampleRateHz <= 0) {
    throw new Error('HackRF sample rate must be a positive integer.')
  }
  const payload = new ArrayBuffer(8)
  const view = new DataView(payload)
  view.setUint32(0, sampleRateHz, true)
  view.setUint32(4, 1, true)
  return payload
}

export function packHackRfFrequency(centerFrequencyHz: number): ArrayBuffer {
  if (
    !Number.isSafeInteger(centerFrequencyHz) ||
    centerFrequencyHz < 1_000_000 ||
    centerFrequencyHz > 6_000_000_000
  ) {
    throw new Error('HackRF center frequency must be an integer from 1 MHz to 6 GHz.')
  }
  const payload = new ArrayBuffer(8)
  const view = new DataView(payload)
  const megahertz = Math.floor(centerFrequencyHz / 1_000_000)
  view.setUint32(0, megahertz, true)
  view.setUint32(4, centerFrequencyHz - megahertz * 1_000_000, true)
  return payload
}

export function splitUint32(value: number): { value: number; index: number } {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0xffff_ffff) {
    throw new Error('USB control value must be an unsigned 32-bit integer.')
  }
  return { value: value & 0xffff, index: value >>> 16 }
}

export function hackRfBasebandFilterForSampleRate(sampleRateHz: number): number {
  const target = sampleRateHz * 0.75
  let selected: number = HACKRF_BASEBAND_FILTERS_HZ[0]
  for (const bandwidthHz of HACKRF_BASEBAND_FILTERS_HZ) {
    if (bandwidthHz > target) break
    selected = bandwidthHz
  }
  return selected
}

export function resolveHackRfStreamingInterface(
  configuration: UsbConfiguration,
): HackRfStreamingInterface {
  const candidates = configuration.interfaces.flatMap((deviceInterface) =>
    deviceInterface.alternates.flatMap((alternate) => {
      if (alternate.interfaceClass !== 0xff) return []
      return alternate.endpoints
        .filter((endpoint) => endpoint.direction === 'in' && endpoint.type === 'bulk')
        .map((endpoint) => ({
          interfaceNumber: deviceInterface.interfaceNumber,
          alternateSetting: alternate.alternateSetting,
          endpointNumber: endpoint.endpointNumber,
        }))
    }),
  )
  candidates.sort(
    (left, right) =>
      Number(left.interfaceNumber !== 0) - Number(right.interfaceNumber !== 0) ||
      Number(left.alternateSetting !== 0) - Number(right.alternateSetting !== 0) ||
      Number(left.endpointNumber !== 1) - Number(right.endpointNumber !== 1),
  )
  const selected = candidates[0]
  if (!selected) {
    throw new Error('HackRF configuration has no vendor-specific bulk-IN endpoint.')
  }
  return selected
}

export class HackRfIqBlockAssembler {
  readonly #block: Int8Array
  #offset = 0

  constructor(fftSize: HackRfFftSize) {
    this.#block = new Int8Array(fftSize * 2)
  }

  push(data: DataView | Uint8Array, onBlock: (block: Int8Array) => void): number {
    const source =
      data instanceof DataView
        ? new Int8Array(data.buffer, data.byteOffset, data.byteLength)
        : new Int8Array(data.buffer, data.byteOffset, data.byteLength)
    let sourceOffset = 0
    let completed = 0
    while (sourceOffset < source.length) {
      const length = Math.min(this.#block.length - this.#offset, source.length - sourceOffset)
      this.#block.set(source.subarray(sourceOffset, sourceOffset + length), this.#offset)
      sourceOffset += length
      this.#offset += length
      if (this.#offset === this.#block.length) {
        onBlock(this.#block)
        this.#offset = 0
        completed += 1
      }
    }
    return completed
  }

  reset(): void {
    this.#offset = 0
  }
}

export function normalizeHackRfIq(source: Int8Array, target: Float32Array): void {
  if (source.length !== target.length) {
    throw new Error(`IQ buffer length mismatch: ${source.length} raw bytes, ${target.length} floats.`)
  }
  for (let index = 0; index < source.length; index += 1) {
    target[index] = source[index] / 128
  }
}

export function removeHackRfDcOffset(iq: Float32Array): void {
  if (iq.length === 0 || iq.length % 2 !== 0) {
    throw new Error('HackRF DC correction requires complete interleaved I/Q samples.')
  }
  const sampleCount = iq.length / 2
  let sumI = 0
  let sumQ = 0
  for (let index = 0; index < iq.length; index += 2) {
    sumI += iq[index]
    sumQ += iq[index + 1]
  }
  const meanI = sumI / sampleCount
  const meanQ = sumQ / sampleCount
  for (let index = 0; index < iq.length; index += 2) {
    iq[index] -= meanI
    iq[index + 1] -= meanQ
  }
}
