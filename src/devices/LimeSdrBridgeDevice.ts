import type { DeviceDebugSnapshot, SDRGainStage } from './ISDRDevice';
import { BridgeBackedDevice } from './bridge/BridgeBackedDevice';

const LIME_GAINS: SDRGainStage[] = [
  { name: 'LNA', label: 'LNA Gain (dB)', min: 0, max: 30, step: 1, value: 16 },
  { name: 'TIA', label: 'TIA Gain (dB)', min: 0, max: 12, step: 3, value: 9 },
  { name: 'PGA', label: 'PGA Gain (dB)', min: -12, max: 19, step: 1, value: 0 }
];

export class LimeSdrBridgeDevice extends BridgeBackedDevice {
  constructor() {
    super({
      sourceType: 'LIMESDR',
      name: 'LimeSDR (Bridge)',
      bridgePeerId: 'limesdr-bridge-peer',
      secret: 'rad-limesdr-bridge',
      capabilityDescriptors: [
        { id: 'stream', label: 'IQ stream', enabled: true },
        { id: 'gain', label: 'Gain control', enabled: true },
        { id: 'clock', label: 'Clock telemetry', enabled: true },
        { id: 'diag', label: 'Diagnostics', enabled: true }
      ],
      requestedCapabilities: ['stream', 'gain', 'clock', 'diag'],
      supportedSampleRatesHz: [1_000_000, 2_000_000, 5_000_000, 10_000_000],
      supportedAnalogBandwidthsHz: [1_500_000, 5_000_000, 10_000_000],
      gainStages: LIME_GAINS,
      initialFrequencyHz: 100_000_000,
      initialSampleRateHz: 2_000_000,
      sampleType: 'i16',
      capabilityModelPatch: {
        agcControl: 'supported',
        clocking: {
          internalClock: 'supported',
          external10MhzRef: 'supported',
          referenceLockTelemetry: 'unknown'
        }
      }
    });
  }

  getDebugSnapshot(): DeviceDebugSnapshot {
    return {
      driver: 'LimeSdrBridgeDevice',
      capturedAt: new Date().toISOString(),
      descriptor: {
        vendorId: 0x0403,
        productId: 0x601f,
        manufacturerName: 'Lime Microsystems',
        productName: this.name
      },
      recentTrace: this.getBridgeTrace().slice(-16).map((entry) => ({
        ts: new Date().toISOString(),
        event: entry
      }))
    };
  }
}
