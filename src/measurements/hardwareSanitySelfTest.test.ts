import { describe, expect, it } from 'vitest';
import { runHardwareSanitySelfTest } from './hardwareSanitySelfTest';

describe('runHardwareSanitySelfTest', () => {
  it('passes when all sanity checks meet thresholds', () => {
    const report = runHardwareSanitySelfTest({
      sampleFormatOk: true,
      iqOrderingOk: true,
      dcOffset01: 0.04,
      clockOffsetPpm: 55,
      gainStepEffective: true,
      continuityOk: true
    });

    expect(report.passed).toBe(true);
    expect(report.checks.every((check) => check.passed)).toBe(true);
  });

  it('fails and reports failing checks when thresholds are violated', () => {
    const report = runHardwareSanitySelfTest({
      sampleFormatOk: true,
      iqOrderingOk: false,
      dcOffset01: 0.24,
      clockOffsetPpm: 480,
      gainStepEffective: false,
      continuityOk: false
    });

    expect(report.passed).toBe(false);
    expect(report.checks.filter((check) => !check.passed).map((check) => check.key)).toEqual([
      'iq-ordering',
      'dc-offset',
      'clock-offset',
      'gain-step',
      'stream-continuity'
    ]);
  });
});
