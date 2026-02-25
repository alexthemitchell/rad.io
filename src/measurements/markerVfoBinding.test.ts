import { describe, expect, it } from 'vitest';
import { resolveSecondaryOffsetFromMarkerHz, resolveVfoDisplayFrequencyHz } from './markerVfoBinding';

describe('markerVfoBinding', () => {
  it('resolves active VFO display frequency', () => {
    expect(resolveVfoDisplayFrequencyHz('main', 162_550_000, true, 12_500)).toBe(162_550_000);
    expect(resolveVfoDisplayFrequencyHz('aux', 162_550_000, true, 12_500)).toBe(162_562_500);
    expect(resolveVfoDisplayFrequencyHz('aux', 162_550_000, false, 12_500)).toBe(162_550_000);
  });

  it('derives secondary offset from marker and tuned frequency', () => {
    expect(resolveSecondaryOffsetFromMarkerHz(162_562_500, 162_550_000)).toBe(12_500);
  });
});
