import { describe, expect, it } from 'vitest';
import { validateStrategySwitch, validateVfoContinuity } from './multiVfoConformance';

describe('multiVfoConformance', () => {
  it('validates continuity including dropped-sample discontinuities', () => {
    const result = validateVfoContinuity([
      { sequence: 10, sampleIndex: 1000, sampleCount: 256 },
      { sequence: 11, sampleIndex: 1256, sampleCount: 256 },
      {
        sequence: 12,
        sampleIndex: 1536,
        sampleCount: 256,
        discontinuity: { cause: 'dropped_samples', droppedSamples: 24 }
      }
    ]);

    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('detects strategy-switch regressions', () => {
    const ok = validateStrategySwitch({
      previousVfoCount: 2,
      nextVfoCount: 3,
      previousStrategy: 'direct',
      nextStrategy: 'pfb-decimate',
      preservedOrder: true
    });
    expect(ok.ok).toBe(true);

    const bad = validateStrategySwitch({
      previousVfoCount: 3,
      nextVfoCount: 2,
      previousStrategy: 'pfb-decimate',
      nextStrategy: 'pfb-decimate',
      preservedOrder: false
    });
    expect(bad.ok).toBe(false);
    expect(bad.issue).toContain('expected direct');
  });
});
