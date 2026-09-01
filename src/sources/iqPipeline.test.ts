import { describe, expect, it } from 'vitest'
import {
  convertUnsignedIqToSignedInPlace,
  InterleavedIqBlockAssembler,
  normalizeSignedIq,
  removeComplexDcOffset,
} from './iqPipeline'

describe('IQ pipeline', () => {
  it('assembles fragmented signed IQ into complete complex blocks', () => {
    const assembler = new InterleavedIqBlockAssembler(2)
    const blocks: number[][] = []

    expect(assembler.push(Int8Array.of(1, 2, 3), () => undefined)).toBe(0)
    expect(assembler.push(Int8Array.of(4, 5, 6, 7, 8), (block) => {
      blocks.push([...block])
    })).toBe(2)

    expect(blocks).toEqual([[1, 2, 3, 4], [5, 6, 7, 8]])
  })

  it('converts unsigned RTL-SDR bytes to signed IQ in place', () => {
    const unsigned = Uint8Array.of(0, 127, 128, 255)

    const signed = convertUnsignedIqToSignedInPlace(unsigned)

    expect([...signed]).toEqual([-128, -1, 0, 127])
    expect(signed.buffer).toBe(unsigned.buffer)
  })

  it('rejects an incomplete unsigned IQ pair', () => {
    expect(() => convertUnsignedIqToSignedInPlace(Uint8Array.of(0))).toThrow(
      'complete interleaved I/Q samples',
    )
  })

  it('normalizes signed IQ and removes independent I/Q means', () => {
    const target = new Float32Array(4)
    normalizeSignedIq(Int8Array.of(-128, -64, 0, 64), target)

    removeComplexDcOffset(target)

    expect([...target]).toEqual([-0.5, -0.5, 0.5, 0.5])
  })
})