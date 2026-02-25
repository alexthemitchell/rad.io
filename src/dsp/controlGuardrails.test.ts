import { describe, expect, it } from 'vitest';
import {
  aliasSafeHighCutMaxHz,
  MODE_CONTROL_CONTRACTS,
  clampFilterForMode,
  clampFineTuneHz,
  lockStateLabel,
  maxFineTuneHzForFilter,
  planStreamRateForMode
} from './controlGuardrails';

describe('controlGuardrails', () => {
  it('clamps low/high cuts to mode contract with minimum spacing', () => {
    const am = clampFilterForMode('AM', -100, 1_000);
    expect(am.lowCutHz).toBe(MODE_CONTROL_CONTRACTS.AM.lowCutMinHz);
    expect(am.highCutHz).toBe(MODE_CONTROL_CONTRACTS.AM.highCutMinHz);

    const nfm = clampFilterForMode('NFM', 1_500, 2_100);
    expect(nfm.lowCutHz).toBe(1_500);
    expect(nfm.highCutHz).toBeGreaterThanOrEqual(1_750);
  });

  it('constrains fine tune to alias-safe window', () => {
    const maxFine = maxFineTuneHzForFilter(14_000, 2_000_000);
    expect(clampFineTuneHz(999_999, 14_000, 2_000_000)).toBe(maxFine);
    expect(clampFineTuneHz(-999_999, 14_000, 2_000_000)).toBe(-maxFine);
  });

  it('provides mode-specific lock labels', () => {
    expect(lockStateLabel('WFM', 'locked')).toContain('pilot');
    expect(lockStateLabel('AM', 'degraded')).toContain('carrier');
    expect(lockStateLabel('NFM', 'searching')).toContain('discriminator');
  });

  it('constrains high cut by alias-safe ceiling for active sample rate', () => {
    const sampleRateHz = 250_000;
    const clamped = clampFilterForMode('WFM', 80, 18_000, sampleRateHz);
    const expectedMax = Math.min(MODE_CONTROL_CONTRACTS.WFM.highCutMaxHz, aliasSafeHighCutMaxHz(sampleRateHz));

    expect(clamped.highCutHz).toBeLessThanOrEqual(expectedMax);
  });

  it('plans stream rate from mode and bandwidth constraints', () => {
    const nfmPlan = planStreamRateForMode('NFM', 3_400);
    const wfmPlan = planStreamRateForMode('WFM', 18_000);

    expect(nfmPlan.sampleRateHz).toBeGreaterThanOrEqual(250_000);
    expect(nfmPlan.decimationFactor).toBeGreaterThanOrEqual(1);
    expect(Math.abs(nfmPlan.outputSampleRateHz - 50_000)).toBeLessThanOrEqual(2_000);
    expect(wfmPlan.sampleRateHz).toBeGreaterThanOrEqual(nfmPlan.sampleRateHz);
  });

  it('keeps per-mode hearing-safety output defaults within policy bounds', () => {
    const contracts = Object.values(MODE_CONTROL_CONTRACTS);
    for (const contract of contracts) {
      expect(contract.defaultOutputLevel).toBeGreaterThanOrEqual(0.35);
      expect(contract.defaultOutputLevel).toBeLessThanOrEqual(0.6);
      expect(contract.defaultMaxOutputLevel).toBeGreaterThanOrEqual(contract.defaultOutputLevel);
      expect(contract.defaultMaxOutputLevel).toBeLessThanOrEqual(0.82);
    }
  });
});
