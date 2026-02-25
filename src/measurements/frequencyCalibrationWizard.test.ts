import { describe, expect, it } from 'vitest';
import {
  CALIBRATION_SOURCE_CATALOG,
  buildFrequencyCalibrationResult,
  canApplySuggestedPpm,
  runFrequencyCalibrationWizard
} from './frequencyCalibrationWizard';

describe('frequencyCalibrationWizard', () => {
  it('provides practical source catalog entries', () => {
    expect(CALIBRATION_SOURCE_CATALOG.length).toBeGreaterThanOrEqual(4);
    expect(CALIBRATION_SOURCE_CATALOG.map((entry) => entry.id)).toContain('wfm-pilot-19khz');
    expect(CALIBRATION_SOURCE_CATALOG.map((entry) => entry.id)).toContain('wwv-chu-timebase');
  });

  it('returns ready when evidence is strong', () => {
    const assessment = runFrequencyCalibrationWizard({
      sourceId: 'lab-signal-generator',
      observedSNRDb: 30,
      observationSeconds: 40,
      lockStable: true,
      driftEstimateHzPerSec: 0.4
    });

    expect(assessment.readiness).toBe('ready');
    expect(assessment.confidence01).toBeGreaterThan(0.65);
    expect(assessment.actions).toHaveLength(0);
  });

  it('requests more evidence when prerequisites are weak', () => {
    const assessment = runFrequencyCalibrationWizard({
      sourceId: 'wwv-chu-timebase',
      observedSNRDb: 5,
      observationSeconds: 12,
      lockStable: false,
      driftEstimateHzPerSec: 3.4
    });

    expect(assessment.readiness).toBe('needs-more-evidence');
    expect(assessment.actions.length).toBeGreaterThanOrEqual(2);
  });

  it('allows applying suggested PPM only when readiness and confidence are sufficient', () => {
    const ready = runFrequencyCalibrationWizard({
      sourceId: 'lab-signal-generator',
      observedSNRDb: 28,
      observationSeconds: 30,
      lockStable: true,
      driftEstimateHzPerSec: 0.3
    });
    const weak = runFrequencyCalibrationWizard({
      sourceId: 'wwv-chu-timebase',
      observedSNRDb: 4,
      observationSeconds: 8,
      lockStable: false,
      driftEstimateHzPerSec: 3.2
    });

    expect(canApplySuggestedPpm(ready)).toBe(true);
    expect(canApplySuggestedPpm(weak)).toBe(false);
  });

  it('builds a durable calibration result record', () => {
    const assessment = runFrequencyCalibrationWizard({
      sourceId: 'wfm-pilot-19khz',
      observedSNRDb: 19,
      observationSeconds: 40,
      lockStable: true,
      driftEstimateHzPerSec: 0.9
    });

    const result = buildFrequencyCalibrationResult({
      assessedAtUtc: '2026-02-25T18:10:00.000Z',
      assessment,
      driftEstimateHzPerSec: 0.9,
      observationSeconds: 42.4
    });

    expect(result.sourceId).toBe('wfm-pilot-19khz');
    expect(result.observationSeconds).toBe(42);
    expect(result.confidence01).toBeCloseTo(assessment.confidence01, 6);
    expect(result.ppmCorrection).toBeCloseTo(assessment.suggestedPpmCorrection, 6);
  });
});
