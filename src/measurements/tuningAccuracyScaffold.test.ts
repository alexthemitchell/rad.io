import { describe, expect, it } from 'vitest';
import {
  createRealDeviceTuningAccuracyScenarioScaffold,
  createSimTuningAccuracyScenario,
  evaluateTuningAccuracyScenario
} from './tuningAccuracyScaffold';

describe('tuningAccuracyScaffold', () => {
  it('evaluates deterministic simulated retune scenarios', () => {
    const scenario = createSimTuningAccuracyScenario();
    const report = evaluateTuningAccuracyScenario(scenario);

    expect(report.source).toBe('sim-fixture');
    expect(report.total).toBe(3);
    expect(report.failures).toBe(0);
    expect(report.passed).toBe(true);
  });

  it('supports real-device scaffolds once observed points are provided', () => {
    const scenario = createRealDeviceTuningAccuracyScenarioScaffold('real-hackrf-ci-window');
    scenario.points.push(
      {
        label: 'beacon-a',
        requestedFrequencyHz: 100_700_000,
        observedFrequencyHz: 100_700_134,
        dwellMs: 1200
      },
      {
        label: 'beacon-b',
        requestedFrequencyHz: 162_550_000,
        observedFrequencyHz: 162_549_877,
        dwellMs: 1200
      }
    );

    const report = evaluateTuningAccuracyScenario(scenario);
    expect(report.source).toBe('real-device');
    expect(report.total).toBe(2);
    expect(report.caseResults.map((item) => item.label)).toEqual(['beacon-a', 'beacon-b']);
  });
});
