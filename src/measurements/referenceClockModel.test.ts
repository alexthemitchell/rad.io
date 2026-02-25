import { describe, expect, it } from 'vitest';
import { defaultCapabilityModel } from '../devices/CapabilityModel';
import {
  deriveReferenceClockSupportModel,
  evaluateReferenceLockProof
} from './referenceClockModel';

describe('referenceClockModel', () => {
  it('derives support model from capability and truth mode', () => {
    const capability = defaultCapabilityModel('HACKRF', 'HackRF One');
    capability.clocking.external10MhzRef = 'supported';
    capability.clocking.referenceLockTelemetry = 'supported';

    const model = deriveReferenceClockSupportModel({
      sourceType: 'HACKRF',
      capabilityModel: capability,
      sampleClockTruthMode: 'disciplined_ref'
    });

    expect(model.supported).toBe(true);
    expect(model.activeClockPath).toBe('external');
  });

  it('returns pass when lock proof window is stable', () => {
    const supportModel = {
      supported: true,
      externalReferenceSupport: 'supported' as const,
      telemetrySupport: 'supported' as const,
      activeClockPath: 'external' as const,
      summary: 'ok'
    };

    const assessment = evaluateReferenceLockProof({
      supportModel,
      sampleClockTruthMode: 'disciplined_ref',
      minWindowSeconds: 30,
      samples: [
        {
          tsIso: '2026-02-25T00:00:00.000Z',
          driftConfidence01: 0.9,
          phaseErrorRms: 0.02,
          audioResamplerRatioDeltaPpm: 10,
          usbTransferJitterMs: 1.2,
          usbErrorCount: 0
        },
        {
          tsIso: '2026-02-25T00:00:40.000Z',
          driftConfidence01: 0.88,
          phaseErrorRms: 0.03,
          audioResamplerRatioDeltaPpm: 12,
          usbTransferJitterMs: 1.5,
          usbErrorCount: 0
        }
      ]
    });

    expect(assessment.status).toBe('pass');
    expect(assessment.confidence01).toBeGreaterThan(0.7);
  });

  it('returns insufficient when proof window is too short', () => {
    const supportModel = {
      supported: true,
      externalReferenceSupport: 'supported' as const,
      telemetrySupport: 'supported' as const,
      activeClockPath: 'external' as const,
      summary: 'ok'
    };

    const assessment = evaluateReferenceLockProof({
      supportModel,
      sampleClockTruthMode: 'disciplined_ref',
      minWindowSeconds: 30,
      samples: [
        {
          tsIso: '2026-02-25T00:00:00.000Z',
          driftConfidence01: 0.85,
          phaseErrorRms: 0.03,
          audioResamplerRatioDeltaPpm: 12,
          usbTransferJitterMs: 2,
          usbErrorCount: 0
        },
        {
          tsIso: '2026-02-25T00:00:10.000Z',
          driftConfidence01: 0.86,
          phaseErrorRms: 0.03,
          audioResamplerRatioDeltaPpm: 12,
          usbTransferJitterMs: 2,
          usbErrorCount: 0
        }
      ]
    });

    expect(assessment.status).toBe('insufficient');
    expect(assessment.reasons).toContain('window-too-short');
  });
});
