import { describe, expect, it } from 'vitest';
import { defaultCapabilityModel } from './CapabilityModel';
import { negotiateDeviceCapabilities } from './CapabilityNegotiationAlgorithm';

describe('CapabilityNegotiationAlgorithm', () => {
  it('selects rate/bandwidth, ordered gains, and a deterministic reapply order', () => {
    const capability = {
      ...defaultCapabilityModel('HACKRF', 'HackRF One'),
      supportedSampleRatesHz: [250_000, 1_000_000, 2_000_000],
      supportedAnalogBandwidthsHz: [200_000, 1_750_000],
      gainStages: [
        { name: 'VGA', min: 0, max: 62, step: 2, order: 2 },
        { name: 'LNA', min: 0, max: 40, step: 8, order: 1 }
      ]
    };

    const result = negotiateDeviceCapabilities({
      capability,
      requestedSampleRateHz: 1_500_000,
      requestedBandwidthHz: 2_000_000,
      requestedGainByStage: {
        LNA: 37,
        VGA: -1
      },
      requestedStreamingProfile: 'balanced',
      compatibilityStatus: 'known-good'
    });

    expect(result.selectedSampleRateHz).toBe(1_000_000);
    expect(result.selectedBandwidthHz).toBe(1_750_000);
    expect(result.selectedGains).toEqual([
      { name: 'LNA', value: 40 },
      { name: 'VGA', value: 0 }
    ]);
    expect(result.selectedStreamingProfile.profileName).toBe('balanced');
    expect(result.reapplyOrder).toEqual(['sample-rate', 'bandwidth', 'gains', 'streaming-profile']);
    expect(result.decisionTrace.length).toBeGreaterThan(0);
  });

  it('downgrades unsafe low-latency requests when compatibility is unknown', () => {
    const capability = {
      ...defaultCapabilityModel('HACKRF', 'HackRF One'),
      supportedSampleRatesHz: [2_000_000],
      supportedAnalogBandwidthsHz: [1_750_000]
    };

    const result = negotiateDeviceCapabilities({
      capability,
      requestedSampleRateHz: 2_000_000,
      requestedBandwidthHz: 1_750_000,
      requestedStreamingProfile: 'low-latency',
      compatibilityStatus: 'unknown'
    });

    expect(result.selectedStreamingProfile.profileName).toBe('balanced');
    expect(result.decisionTrace.some((entry) => entry.includes('downgraded low-latency -> balanced'))).toBe(true);
  });

  it('forces stable profile for known-unsupported compatibility status', () => {
    const capability = {
      ...defaultCapabilityModel('HACKRF', 'HackRF One'),
      supportedSampleRatesHz: [2_000_000],
      supportedAnalogBandwidthsHz: [1_750_000]
    };

    const result = negotiateDeviceCapabilities({
      capability,
      requestedSampleRateHz: 2_000_000,
      requestedBandwidthHz: 1_750_000,
      requestedStreamingProfile: 'low-latency',
      compatibilityStatus: 'known-unsupported'
    });

    expect(result.selectedStreamingProfile.profileName).toBe('stable');
    expect(result.decisionTrace.some((entry) => entry.includes('forced to stable'))).toBe(true);
  });
});
