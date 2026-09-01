export class InterleavedIqBlockAssembler {
  readonly #block: Int8Array
  #offset = 0

  constructor(complexSampleCount: number) {
    if (!Number.isSafeInteger(complexSampleCount) || complexSampleCount <= 0) {
      throw new Error('IQ block size must be a positive integer.')
    }
    this.#block = new Int8Array(complexSampleCount * 2)
  }

  push(data: DataView | Uint8Array | Int8Array, onBlock: (block: Int8Array) => void): number {
    const source = new Int8Array(data.buffer, data.byteOffset, data.byteLength)
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

export function convertUnsignedIqToSignedInPlace(iq: Uint8Array): Int8Array {
  if (iq.length % 2 !== 0) {
    throw new Error('IQ conversion requires complete interleaved I/Q samples.')
  }
  for (let index = 0; index < iq.length; index += 1) {
    iq[index] ^= 0x80
  }
  return new Int8Array(iq.buffer, iq.byteOffset, iq.byteLength)
}

export function normalizeSignedIq(source: Int8Array, target: Float32Array): void {
  if (source.length !== target.length) {
    throw new Error(`IQ buffer length mismatch: ${source.length} raw bytes, ${target.length} floats.`)
  }
  for (let index = 0; index < source.length; index += 1) {
    target[index] = source[index] / 128
  }
}

export function removeComplexDcOffset(iq: Float32Array): void {
  if (iq.length === 0 || iq.length % 2 !== 0) {
    throw new Error('DC correction requires complete interleaved I/Q samples.')
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