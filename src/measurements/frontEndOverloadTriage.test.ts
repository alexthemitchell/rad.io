import { describe, expect, it } from 'vitest';
import { assessFrontEndOverloadTriage } from './frontEndOverloadTriage';

describe('assessFrontEndOverloadTriage', () => {
  it('flags overload and dynamic range degradation under high spur density and clipping risk', () => {
    const result = assessFrontEndOverloadTriage({
      frequencyHz: 101_700_000,
      fftPeakDb: -4,
      fftMeanDb: -52,
      elevatedBinCount: 170,
      totalBinCount: 2048,
      clipRisk01: 0.62,
      snrEstimateDb: 11,
      hasAttenuatorHint: false,
      hasPreampHint: true
    });

    expect(result.overloadLikely).toBe(true);
    expect(result.dynamicRangeDegraded).toBe(true);
    expect(result.overloadSummary).toContain('Overload likely');
    expect(result.overloadActions.join(' ')).toContain('attenuation');
    expect(result.overloadActions.join(' ')).toContain('preamp');
  });

  it('keeps healthy assessment for lower spur density with adequate SNR', () => {
    const result = assessFrontEndOverloadTriage({
      frequencyHz: 7_150_000,
      fftPeakDb: -19,
      fftMeanDb: -46,
      elevatedBinCount: 18,
      totalBinCount: 2048,
      clipRisk01: 0.08,
      snrEstimateDb: 24,
      hasAttenuatorHint: true,
      hasPreampHint: false
    });

    expect(result.overloadLikely).toBe(false);
    expect(result.dynamicRangeDegraded).toBe(false);
    expect(result.dynamicRangeSummary).toContain('looks stable');
    expect(result.overloadActions.join(' ')).toContain('high-pass');
  });
});
