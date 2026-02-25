import { describe, expect, it } from 'vitest';
import { runLevelCalibrationWizard } from './levelCalibrationWizard';

describe('levelCalibrationWizard', () => {
  it('returns ready when lock, drift, and SNR evidence are strong', () => {
    const assessment = runLevelCalibrationWizard({
      sourceId: 'lab-signal-generator',
      bandId: 'vhf',
      observedSignalDbfs: -38,
      expectedSignalDbm: -67,
      observedNoiseFloorDbfs: -98,
      observationSeconds: 60,
      driftConfidence01: 0.88,
      lockStable: true,
      rfChainNetGainDb: 4
    });

    expect(assessment.readiness).toBe('ready');
    expect(assessment.confidence01).toBeGreaterThan(0.65);
    expect(assessment.dbfsToDbmOffset).toBeCloseTo(-29, 6);
    expect(assessment.uncertaintyDb).toBeLessThan(4);
  });

  it('requests more evidence when lock and SNR are weak', () => {
    const assessment = runLevelCalibrationWizard({
      sourceId: 'noaa-weather-carrier',
      bandId: 'vhf',
      observedSignalDbfs: -74,
      expectedSignalDbm: -93,
      observedNoiseFloorDbfs: -84,
      observationSeconds: 12,
      driftConfidence01: 0.3,
      lockStable: false,
      rfChainNetGainDb: 12
    });

    expect(assessment.readiness).toBe('needs-more-evidence');
    expect(assessment.actions.length).toBeGreaterThan(1);
    expect(assessment.uncertaintyDb).toBeGreaterThan(3);
  });
});
