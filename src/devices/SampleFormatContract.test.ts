import { describe, expect, it } from 'vitest';
import { normalizeInterleavedIq } from './SampleFormatContract';

describe('SampleFormatContract', () => {
  it('normalizes unsigned u8 IQ into approx [-1, 1]', () => {
    const bytes = new Uint8Array([0, 128, 255]);
    const normalized = normalizeInterleavedIq(bytes, 'u8-iq-interleaved');

    expect(normalized.format).toBe('u8-iq-interleaved');
    expect(normalized.normalizedIq[0]).toBeCloseTo(-1, 2);
    expect(normalized.normalizedIq[1]).toBeCloseTo(0, 2);
    expect(normalized.normalizedIq[2]).toBeGreaterThan(0.98);
  });

  it('normalizes signed i8 IQ into approx [-1, 1]', () => {
    const bytes = new Int8Array([-128, 0, 127]);
    const normalized = normalizeInterleavedIq(bytes, 'i8-iq-interleaved');

    expect(normalized.format).toBe('i8-iq-interleaved');
    expect(normalized.normalizedIq[0]).toBeCloseTo(-1, 2);
    expect(normalized.normalizedIq[1]).toBeCloseTo(0, 2);
    expect(normalized.normalizedIq[2]).toBeGreaterThan(0.98);
  });
});
