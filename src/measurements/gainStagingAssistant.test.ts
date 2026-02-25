import { describe, expect, it } from 'vitest';
import { assessGainStagingAssistant } from './gainStagingAssistant';

describe('gainStagingAssistant', () => {
  const gainStages = [
    { name: 'LNA', label: 'LNA', min: 0, max: 40, step: 8, value: 16 },
    { name: 'VGA', label: 'VGA', min: 0, max: 62, step: 2, value: 20 },
    { name: 'AMP', label: 'AMP', min: 0, max: 1, step: 1, value: 1 }
  ];

  it('classifies HF and emits conservative preset under overload risk', () => {
    const assessment = assessGainStagingAssistant({
      frequencyHz: 7_100_000,
      demodMode: 'AM',
      gainStages,
      currentGains: { LNA: 24, VGA: 30, AMP: 1 },
      iqPeakLinear: 1.02,
      audioClippingRatio: 0.08,
      snrEstimateDb: 24,
      overloadLikely: true
    });

    expect(assessment.band).toBe('hf');
    expect(assessment.severity).toBe('warn');
    expect(assessment.summary).toContain('conservative');
    expect(assessment.recommendedGains.AMP).toBe(0);
  });

  it('keeps balanced preset for stable VHF conditions', () => {
    const assessment = assessGainStagingAssistant({
      frequencyHz: 145_500_000,
      demodMode: 'NFM',
      gainStages,
      currentGains: { LNA: 8, VGA: 18, AMP: 0 },
      iqPeakLinear: 0.8,
      audioClippingRatio: 0.001,
      snrEstimateDb: 18,
      overloadLikely: false
    });

    expect(assessment.band).toBe('vhf');
    expect(assessment.severity).toBe('ok');
    expect(assessment.actions.length).toBeGreaterThan(0);
    expect(assessment.recommendedGains.LNA).toBeGreaterThanOrEqual(0);
  });

  it('increases headroom target when SNR is weak but no clipping signs', () => {
    const weakAssessment = assessGainStagingAssistant({
      frequencyHz: 435_000_000,
      demodMode: 'WFM',
      gainStages,
      currentGains: { LNA: 0, VGA: 8, AMP: 0 },
      iqPeakLinear: 0.6,
      audioClippingRatio: 0,
      snrEstimateDb: 6,
      overloadLikely: false
    });

    expect(weakAssessment.band).toBe('uhf');
    expect(weakAssessment.severity).toBe('ok');
    expect(weakAssessment.recommendedGains.VGA).toBeGreaterThan(8);
  });
});
