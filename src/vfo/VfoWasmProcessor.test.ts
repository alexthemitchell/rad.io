import { describe, expect, it, vi } from 'vitest'
import type { VfoAudioBatch } from '../../crates/dsp-wasm/pkg/dsp_wasm.js'
import { drainVfoAudioBatch } from './VfoWasmProcessor'

function batch(change: Record<string, unknown> = {}) {
  const free = vi.fn()
  return {
    block_count: 2,
    ids: ['vfo-1', 'vfo-2'],
    revisions: new Uint32Array([1, 2]),
    source_timestamps_us: new BigUint64Array([100n, 200n]),
    sample_rates_hz: new Uint32Array([48_000, 48_000]),
    channel_counts: new Uint8Array([1, 2]),
    signal_levels_dbfs: new Float32Array([-20, -30]),
    squelched: new Uint8Array([0, 1]),
    sample_offsets: new Uint32Array([0, 2, 6]),
    samples: new Float32Array([0.1, 0.2, 0.3, -0.3, 0.4, -0.4]),
    free,
    ...change,
  } as unknown as VfoAudioBatch & { free: ReturnType<typeof vi.fn> }
}

describe('drainVfoAudioBatch', () => {
  it('maps independent mono and stereo blocks and frees the WASM batch', () => {
    const source = batch()

    const blocks = drainVfoAudioBatch(source)

    expect(blocks).toHaveLength(2)
    expect(blocks[0]).toMatchObject({
      vfoId: 'vfo-1',
      revision: 1,
      sourceTimestampUs: 100n,
      channelCount: 1,
      squelched: false,
    })
    expect([...blocks[0].samples]).toEqual([
      expect.closeTo(0.1, 6),
      expect.closeTo(0.2, 6),
    ])
    expect(blocks[1]).toMatchObject({
      vfoId: 'vfo-2',
      revision: 2,
      sourceTimestampUs: 200n,
      channelCount: 2,
      squelched: true,
    })
    expect(source.free).toHaveBeenCalledOnce()
  })

  it.each([
    new Uint32Array([1, 2, 6]),
    new Uint32Array([0, 5, 4]),
    new Uint32Array([0, 1, 6]),
  ])('rejects invalid sample offsets and still frees the batch', (sampleOffsets) => {
    const source = batch({ sample_offsets: sampleOffsets })

    expect(() => drainVfoAudioBatch(source)).toThrow(/offsets|incomplete frames/)
    expect(source.free).toHaveBeenCalledOnce()
  })
})