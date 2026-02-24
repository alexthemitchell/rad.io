import { describe, expect, it } from 'vitest';
import { buildSignalIdTuningAdvisor } from './signalIdTuningAdvisor';

describe('buildSignalIdTuningAdvisor', () => {
  it('classifies fm-like scenarios with wideband recommendation', () => {
    const result = buildSignalIdTuningAdvisor({
      peakDbfs: -12,
      meanDbfs: -58,
      snrEstimateDb: 24,
      demodMode: 'NFM',
      bandwidthHz: 180_000,
      dcSpurLevelDbfs: -60,
      spurDensity01: 0.01
    });

    expect(result.hint).toBe('fm-like');
    expect(result.recommendedDemodMode).toBe('WFM');
    expect(result.recommendedBandwidthHz).toBe(180_000);
  });

  it('emits false-signal warnings for elevated dc spur and spur density', () => {
    const result = buildSignalIdTuningAdvisor({
      peakDbfs: -8,
      meanDbfs: -30,
      snrEstimateDb: 8,
      demodMode: 'AM',
      bandwidthHz: 10_000,
      dcSpurLevelDbfs: -20,
      spurDensity01: 0.1
    });

    expect(result.warnings).toContain('dc_spur_or_lo_leakage');
    expect(result.warnings).toContain('aliasing_or_image_risk');
    expect(result.summary).toContain('Hint');
  });
});
