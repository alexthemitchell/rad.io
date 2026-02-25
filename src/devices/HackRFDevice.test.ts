import { describe, expect, it } from 'vitest';
import { HackRFDevice } from './HackRFDevice';

describe('HackRFDevice', () => {
  it('reports capability-gated hardware sweep fallback', () => {
    const device = new HackRFDevice();
    const capability = device.getSweepCapability();

    expect(capability.hardwareSupported).toBe(false);
    expect(capability.fallbackMode).toBe('software-sweep-stitch');
    expect(capability.command).toBe('hackrf_sweep');
  });

  it('includes sweep and compatibility metadata in debug snapshot', () => {
    const device = new HackRFDevice();
    const snapshot = device.getDebugSnapshot();

    expect(snapshot.driver).toBe('HackRFDevice');
    expect(snapshot.sweep?.hardwareSupported).toBe(false);
    expect(snapshot.compatibility?.status).toBe('unknown');
  });

  it('exposes a deterministic capability model', () => {
    const device = new HackRFDevice();
    const capability = device.getCapabilityModel();

    expect(capability.sourceType).toBe('HACKRF');
    expect(capability.sampleFormat.sampleType).toBe('i8');
    expect(capability.supportedSampleRatesHz).toContain(2_000_000);
    expect(capability.gainStages.map((stage) => stage.name)).toEqual(['LNA', 'VGA', 'AMP']);
    expect(capability.basebandFilterControl).toBe('supported');
  });
});
