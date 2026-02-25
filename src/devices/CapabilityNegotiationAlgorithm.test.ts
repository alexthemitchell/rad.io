import { describe, expect, it } from 'vitest';
import { defaultCapabilityModel } from './CapabilityModel';
import { negotiateDeviceCapabilities } from './CapabilityNegotiationAlgorithm';

describe('CapabilityNegotiationAlgorithm', () => {
  it('selects nearest supported sample rate and bandwidth at or below request', () => {
    const capability = {
      ...defaultCapabilityModel('HACKRF', 'HackRF One'),
      supportedSampleRatesHz: [250_000, 1_000_000, 2_000_000],
      supportedAnalogBandwidthsHz: [200_000, 1_750_000]
    };

    const result = negotiateDeviceCapabilities({
      capability,
      requestedSampleRateHz: 1_500_000,
      requestedBandwidthHz: 2_000_000
    });

    expect(result.selectedSampleRateHz).toBe(1_000_000);
    expect(result.selectedBandwidthHz).toBe(1_750_000);
    expect(result.decisionTrace.length).toBeGreaterThan(0);
  });
});
