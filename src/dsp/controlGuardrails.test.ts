import { describe, expect, it } from 'vitest';
import {
  MODE_CONTROL_CONTRACTS,
  clampFilterForMode,
  clampFineTuneHz,
  lockStateLabel,
  maxFineTuneHzForFilter
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
});
