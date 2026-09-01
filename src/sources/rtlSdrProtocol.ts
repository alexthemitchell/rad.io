export const RTL_SDR_USB_VENDOR_ID = 0x0bda
export const RTL_SDR_USB_PRODUCT_IDS = [0x2832, 0x2838] as const

export const RTL_SDR_SAMPLE_RATES_HZ = [
  1_024_000,
  2_048_000,
  2_400_000,
] as const

export const E4000_TUNER_GAINS_DB = [
  -1,
  1.5,
  4,
  6.5,
  9,
  11.5,
  14,
  16.5,
  19,
  21.5,
  24,
  29,
  34,
  42,
] as const

export const RTL_SDR_DIRECT_SAMPLE_MAX_HZ = 28_800_000
export const E4000_MIN_FREQUENCY_HZ = 50_000_000
export const E4000_MAX_FREQUENCY_HZ = 2_200_000_000

export type RtlSdrSampleRateHz = (typeof RTL_SDR_SAMPLE_RATES_HZ)[number]
export type RtlSdrFftSize = 1024 | 2048 | 4096
export type RtlSdrDirectSampling = 'off' | 'i' | 'q'

export type RtlSdrConfig = {
  centerFrequencyHz: number
  sampleRateHz: RtlSdrSampleRateHz
  fftSize: RtlSdrFftSize
  tunerGainDb: number | null
  frequencyCorrectionPpm: number
  directSampling: RtlSdrDirectSampling
  biasTeeEnabled: boolean
  frameRate: number
}

export type RtlSdrRuntimeCommand =
  | { type: 'set-center-frequency'; centerFrequencyHz: number }
  | { type: 'set-tuner-gain'; tunerGainDb: number | null }
  | { type: 'set-frequency-correction'; frequencyCorrectionPpm: number }
  | { type: 'set-direct-sampling'; directSampling: RtlSdrDirectSampling }
  | { type: 'set-bias-tee'; biasTeeEnabled: boolean }

export const DEFAULT_RTL_SDR_CONFIG: RtlSdrConfig = {
  centerFrequencyHz: 100_000_000,
  sampleRateHz: 2_400_000,
  fftSize: 2048,
  tunerGainDb: null,
  frequencyCorrectionPpm: 0,
  directSampling: 'off',
  biasTeeEnabled: false,
  frameRate: 30,
}

export function validateRtlSdrConfig(config: RtlSdrConfig): void {
  if (!Number.isSafeInteger(config.centerFrequencyHz) || config.centerFrequencyHz <= 0) {
    throw new Error('RTL-SDR center frequency must be a positive integer.')
  }
  if (config.centerFrequencyHz <= RTL_SDR_DIRECT_SAMPLE_MAX_HZ) {
    if (config.directSampling === 'off') {
      throw new Error('RTL-SDR frequencies at or below 28.8 MHz require direct sampling.')
    }
  } else if (
    config.centerFrequencyHz < E4000_MIN_FREQUENCY_HZ ||
    config.centerFrequencyHz > E4000_MAX_FREQUENCY_HZ
  ) {
    throw new Error('E4000 center frequency must use direct sampling below 28.8 MHz or the tuner from 50 MHz to 2.2 GHz.')
  }
  if (!(RTL_SDR_SAMPLE_RATES_HZ as readonly number[]).includes(config.sampleRateHz)) {
    throw new Error(`Unsupported RTL-SDR sample rate ${config.sampleRateHz}.`)
  }
  if (![1024, 2048, 4096].includes(config.fftSize)) {
    throw new Error(`Unsupported FFT size ${config.fftSize}.`)
  }
  if (
    config.tunerGainDb !== null &&
    !(E4000_TUNER_GAINS_DB as readonly number[]).includes(config.tunerGainDb)
  ) {
    throw new Error(`Unsupported E4000 tuner gain ${config.tunerGainDb} dB.`)
  }
  if (
    !Number.isInteger(config.frequencyCorrectionPpm) ||
    config.frequencyCorrectionPpm < -1_000 ||
    config.frequencyCorrectionPpm > 1_000
  ) {
    throw new Error('RTL-SDR frequency correction must be an integer from -1000 to 1000 PPM.')
  }
  if (!['off', 'i', 'q'].includes(config.directSampling)) {
    throw new Error(`Unsupported RTL-SDR direct-sampling mode ${config.directSampling}.`)
  }
  if (!Number.isFinite(config.frameRate) || config.frameRate < 1 || config.frameRate > 60) {
    throw new Error('RTL-SDR analysis rate must be between 1 and 60 frames per second.')
  }
}

export function configWithRtlSdrRuntimeCommand(
  config: RtlSdrConfig,
  command: RtlSdrRuntimeCommand,
): RtlSdrConfig {
  let next: RtlSdrConfig
  if (command.type === 'set-center-frequency') {
    next = { ...config, centerFrequencyHz: command.centerFrequencyHz }
  } else if (command.type === 'set-tuner-gain') {
    next = { ...config, tunerGainDb: command.tunerGainDb }
  } else if (command.type === 'set-frequency-correction') {
    next = { ...config, frequencyCorrectionPpm: command.frequencyCorrectionPpm }
  } else if (command.type === 'set-direct-sampling') {
    next = { ...config, directSampling: command.directSampling }
  } else {
    next = { ...config, biasTeeEnabled: command.biasTeeEnabled }
  }
  validateRtlSdrConfig(next)
  return next
}