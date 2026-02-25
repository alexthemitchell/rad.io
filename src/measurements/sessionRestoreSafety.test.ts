import { describe, expect, it } from 'vitest';
import { assessRestoreSafety } from './sessionRestoreSafety';

describe('sessionRestoreSafety', () => {
  it('allows low-risk restore snapshots without confirmation', () => {
    const result = assessRestoreSafety({
      sourceType: 'HACKRF',
      demodMode: 'NFM',
      frequencyHz: 162_550_000,
      fineFreqHz: 1_200,
      ppmCorrection: -1.5
    });

    expect(result.requiresConfirmation).toBe(false);
    expect(result.severity).toBe('none');
    expect(result.reasons).toHaveLength(0);
  });

  it('requires confirmation for large ppm and fine-tune offsets', () => {
    const result = assessRestoreSafety({
      sourceType: 'RTLSDR',
      demodMode: 'AM',
      frequencyHz: 7_300_000,
      fineFreqHz: 175_000,
      ppmCorrection: 28
    });

    expect(result.requiresConfirmation).toBe(true);
    expect(result.severity).toBe('warn');
    expect(result.reasons.join(' | ')).toContain('outside the typical stability range');
    expect(result.reasons.join(' | ')).toContain('unusually large');
  });
});
