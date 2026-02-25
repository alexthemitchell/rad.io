import { describe, expect, it } from 'vitest';
import { assessExternalReferenceStability } from './externalReferenceStability';

describe('externalReferenceStability', () => {
  it('returns unknown when not in HackRF streaming mode', () => {
    const assessment = assessExternalReferenceStability({
      sourceType: 'MOCK',
      isStreaming: false,
      lastClockTruthMode: 'unknown',
      driftConfidence: 0,
      phaseErrorRms: 0,
      audioResamplerRatioDeltaPpm: 0,
      usbTransferJitterMs: 0,
      usbRetryCount: 0,
      usbErrorCount: 0
    });

    expect(assessment.status).toBe('unknown');
  });

  it('flags unstable disciplined-reference symptoms', () => {
    const assessment = assessExternalReferenceStability({
      sourceType: 'HACKRF',
      isStreaming: true,
      lastClockTruthMode: 'disciplined_ref',
      driftConfidence: 0.2,
      phaseErrorRms: 0.2,
      audioResamplerRatioDeltaPpm: 180,
      usbTransferJitterMs: 2,
      usbRetryCount: 1,
      usbErrorCount: 0
    });

    expect(assessment.status).toBe('unstable');
    expect(assessment.symptoms).toContain('low-drift-confidence');
    expect(assessment.symptoms).toContain('high-phase-error-rms');
  });

  it('reports stable disciplined-reference telemetry when metrics are clean', () => {
    const assessment = assessExternalReferenceStability({
      sourceType: 'HACKRF',
      isStreaming: true,
      lastClockTruthMode: 'disciplined_ref',
      driftConfidence: 0.85,
      phaseErrorRms: 0.03,
      audioResamplerRatioDeltaPpm: 18,
      usbTransferJitterMs: 1.2,
      usbRetryCount: 0,
      usbErrorCount: 0
    });

    expect(assessment.status).toBe('stable');
    expect(assessment.confidence01).toBeGreaterThan(0.5);
  });
});
