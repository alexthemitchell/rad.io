import { describe, expect, it } from 'vitest';
import { defaultCapabilityModel } from '../devices/CapabilityModel';
import { deriveReferenceClockVisibility } from './referenceClockVisibility';

describe('referenceClockVisibility', () => {
  it('returns unsupported for sources without external clock support', () => {
    const visibility = deriveReferenceClockVisibility({
      capabilityModel: defaultCapabilityModel('RTLSDR', 'RTL-SDR'),
      sampleClockTruthMode: 'unknown',
      externalReferenceAssessment: {
        status: 'unknown',
        confidence01: 0,
        summary: 'n/a'
      },
      sourceType: 'RTLSDR'
    });

    expect(visibility.supported).toBe(false);
    expect(visibility.lockState).toBe('unknown');
  });

  it('maps stable disciplined reference to locked state', () => {
    const capability = defaultCapabilityModel('HACKRF', 'HackRF One');
    capability.clocking.external10MhzRef = 'supported';
    capability.clocking.referenceLockTelemetry = 'supported';

    const visibility = deriveReferenceClockVisibility({
      capabilityModel: capability,
      sampleClockTruthMode: 'disciplined_ref',
      externalReferenceAssessment: {
        status: 'stable',
        confidence01: 0.82,
        summary: 'Disciplined reference telemetry appears stable.'
      },
      sourceType: 'HACKRF'
    });

    expect(visibility.supported).toBe(true);
    expect(visibility.presence).toBe('present');
    expect(visibility.lockState).toBe('locked');
    expect(visibility.confidence01).toBeCloseTo(0.82, 6);
  });
});
