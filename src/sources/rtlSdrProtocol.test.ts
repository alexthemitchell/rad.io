import { describe, expect, it } from 'vitest'
import {
  configWithRtlSdrRuntimeCommand,
  DEFAULT_RTL_SDR_CONFIG,
  validateRtlSdrConfig,
} from './rtlSdrProtocol'

describe('RTL-SDR protocol', () => {
  it('uses a safe E4000 receive configuration by default', () => {
    expect(() => validateRtlSdrConfig(DEFAULT_RTL_SDR_CONFIG)).not.toThrow()
    expect(DEFAULT_RTL_SDR_CONFIG).toMatchObject({
      sampleRateHz: 2_400_000,
      tunerGainDb: null,
      directSampling: 'off',
      biasTeeEnabled: false,
    })
  })

  it('validates stable rates and documented E4000 gain steps', () => {
    expect(() => validateRtlSdrConfig({
      ...DEFAULT_RTL_SDR_CONFIG,
      sampleRateHz: 3_200_000 as never,
    })).toThrow(/sample rate/)
    expect(() => validateRtlSdrConfig({
      ...DEFAULT_RTL_SDR_CONFIG,
      tunerGainDb: 12,
    })).toThrow(/tuner gain/)
    expect(() => validateRtlSdrConfig({
      ...DEFAULT_RTL_SDR_CONFIG,
      tunerGainDb: 11.5,
    })).not.toThrow()
    expect(() => validateRtlSdrConfig({
      ...DEFAULT_RTL_SDR_CONFIG,
      tunerGainDb: 43,
    })).toThrow(/tuner gain/)
  })

  it('requires direct sampling for HF and rejects the unsupported tuning gap', () => {
    expect(() => validateRtlSdrConfig({
      ...DEFAULT_RTL_SDR_CONFIG,
      centerFrequencyHz: 10_000_000,
    })).toThrow(/require direct sampling/)
    expect(() => validateRtlSdrConfig({
      ...DEFAULT_RTL_SDR_CONFIG,
      centerFrequencyHz: 10_000_000,
      directSampling: 'q',
    })).not.toThrow()
    expect(() => validateRtlSdrConfig({
      ...DEFAULT_RTL_SDR_CONFIG,
      centerFrequencyHz: 40_000_000,
      directSampling: 'q',
    })).toThrow(/50 MHz/)
  })

  it('applies runtime commands without altering restart-only settings', () => {
    expect(configWithRtlSdrRuntimeCommand(DEFAULT_RTL_SDR_CONFIG, {
      type: 'set-tuner-gain',
      tunerGainDb: 24,
    })).toEqual({ ...DEFAULT_RTL_SDR_CONFIG, tunerGainDb: 24 })
    expect(configWithRtlSdrRuntimeCommand(DEFAULT_RTL_SDR_CONFIG, {
      type: 'set-bias-tee',
      biasTeeEnabled: true,
    })).toEqual({ ...DEFAULT_RTL_SDR_CONFIG, biasTeeEnabled: true })
  })
})