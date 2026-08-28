import { describe, expect, it } from 'vitest'
import {
  configWithHackRfRuntimeCommand,
  DEFAULT_HACKRF_CONFIG,
  HackRfIqBlockAssembler,
  normalizeHackRfIq,
  removeHackRfDcOffset,
  packHackRfFrequency,
  packHackRfSampleRate,
  resolveHackRfStreamingInterface,
  splitUint32,
  validateHackRfConfig,
} from './hackrfProtocol'
import type { UsbConfiguration } from './webUsb'

describe('HackRF protocol', () => {
  it('packs sample rate and frequency payloads as little-endian uint32 pairs', () => {
    const sampleRate = new DataView(packHackRfSampleRate(2_000_000))
    expect(sampleRate.getUint32(0, true)).toBe(2_000_000)
    expect(sampleRate.getUint32(4, true)).toBe(1)

    const frequency = new DataView(packHackRfFrequency(915_200_123))
    expect(frequency.getUint32(0, true)).toBe(915)
    expect(frequency.getUint32(4, true)).toBe(200_123)
    expect(splitUint32(1_750_000)).toEqual({ value: 46_064, index: 26 })
  })

  it('validates the supported receive controls', () => {
    expect(() => validateHackRfConfig(DEFAULT_HACKRF_CONFIG)).not.toThrow()
    expect(() =>
      validateHackRfConfig({ ...DEFAULT_HACKRF_CONFIG, lnaGainDb: 12 }),
    ).toThrow(/LNA gain/)
    expect(() =>
      validateHackRfConfig({ ...DEFAULT_HACKRF_CONFIG, centerFrequencyHz: 0 }),
    ).toThrow(/center frequency/)
  })

  it('validates runtime changes without altering unrelated settings', () => {
    expect(
      configWithHackRfRuntimeCommand(DEFAULT_HACKRF_CONFIG, {
        type: 'set-center-frequency',
        centerFrequencyHz: 100_250_000,
      }),
    ).toEqual({ ...DEFAULT_HACKRF_CONFIG, centerFrequencyHz: 100_250_000 })
    expect(() =>
      configWithHackRfRuntimeCommand(DEFAULT_HACKRF_CONFIG, {
        type: 'set-vga-gain',
        vgaGainDb: 21,
      }),
    ).toThrow(/VGA gain/)
  })

  it('selects the vendor-specific bulk-IN endpoint from USB descriptors', () => {
    const configuration = {
      configurationValue: 1,
      interfaces: [
        {
          interfaceNumber: 3,
          alternate: {} as never,
          alternates: [
            {
              alternateSetting: 0,
              interfaceClass: 0x03,
              interfaceSubclass: 0,
              interfaceProtocol: 0,
              endpoints: [
                { endpointNumber: 2, direction: 'in', type: 'interrupt', packetSize: 64 },
              ],
            },
          ],
        },
        {
          interfaceNumber: 0,
          alternate: {} as never,
          alternates: [
            {
              alternateSetting: 0,
              interfaceClass: 0xff,
              interfaceSubclass: 0xff,
              interfaceProtocol: 0xff,
              endpoints: [
                { endpointNumber: 1, direction: 'in', type: 'bulk', packetSize: 512 },
                { endpointNumber: 2, direction: 'out', type: 'bulk', packetSize: 512 },
              ],
            },
          ],
        },
      ],
    } satisfies UsbConfiguration

    expect(resolveHackRfStreamingInterface(configuration)).toEqual({
      interfaceNumber: 0,
      alternateSetting: 0,
      endpointNumber: 1,
    })
  })

  it('assembles fragmented transfers and normalizes signed 8-bit IQ', () => {
    const assembler = new HackRfIqBlockAssembler(1024)
    const blocks: Float32Array[] = []
    const first = new Uint8Array(1000).fill(0x7f)
    const second = new Uint8Array(3096)
    second.fill(0x80, 0, 1048)
    second.fill(0x40, 1048)

    expect(assembler.push(first, () => undefined)).toBe(0)
    expect(
      assembler.push(second, (raw) => {
        const normalized = new Float32Array(raw.length)
        normalizeHackRfIq(raw, normalized)
        blocks.push(normalized)
      }),
    ).toBe(2)
    expect(blocks).toHaveLength(2)
    expect(blocks[0][0]).toBeCloseTo(127 / 128)
    expect(blocks[0][999]).toBeCloseTo(127 / 128)
    expect(blocks[0][1000]).toBe(-1)
    expect(blocks[1][0]).toBeCloseTo(0.5)
  })

  it('removes independent I/Q DC offsets without attenuating an AC tone', () => {
    const sampleCount = 1024
    const iq = new Float32Array(sampleCount * 2)
    for (let index = 0; index < sampleCount; index += 1) {
      const phase = Math.PI * 2 * 32 * index / sampleCount
      iq[index * 2] = 0.2 + 0.4 * Math.cos(phase)
      iq[index * 2 + 1] = -0.1 + 0.4 * Math.sin(phase)
    }

    removeHackRfDcOffset(iq)

    let meanI = 0
    let meanQ = 0
    let meanMagnitude = 0
    for (let index = 0; index < sampleCount; index += 1) {
      const i = iq[index * 2]
      const q = iq[index * 2 + 1]
      meanI += i
      meanQ += q
      meanMagnitude += Math.hypot(i, q)
    }
    expect(meanI / sampleCount).toBeCloseTo(0, 6)
    expect(meanQ / sampleCount).toBeCloseTo(0, 6)
    expect(meanMagnitude / sampleCount).toBeCloseTo(0.4, 6)
  })
})