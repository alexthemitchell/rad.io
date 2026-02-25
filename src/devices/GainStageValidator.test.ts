import { describe, expect, it } from 'vitest';
import { clampGainValue, sortGainStagesByOrder, validateGainStageDefinitions } from './GainStageValidator';

describe('GainStageValidator', () => {
  it('sorts by order and clamps with step', () => {
    const stages = [
      { name: 'VGA', min: 0, max: 62, step: 2, order: 2 },
      { name: 'LNA', min: 0, max: 40, step: 8, order: 1 }
    ];

    const sorted = sortGainStagesByOrder(stages);
    expect(sorted[0].name).toBe('LNA');
    expect(clampGainValue(37, sorted[0])).toBe(40);
    expect(clampGainValue(-2, sorted[1])).toBe(0);
  });

  it('flags invalid definitions', () => {
    const issues = validateGainStageDefinitions([
      { name: 'A', min: 10, max: 1, step: 1, order: 1 },
      { name: 'A', min: 0, max: 10, step: 0, order: 1 }
    ]);

    expect(issues.some((issue) => issue.level === 'error')).toBe(true);
  });
});
