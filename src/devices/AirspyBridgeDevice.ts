import type { DeviceDebugSnapshot, SDRGainStage } from './ISDRDevice';
import { BridgeBackedDevice } from './bridge/BridgeBackedDevice';

const AIRSPY_GAINS: SDRGainStage[] = [
  { name: 'LNA', label: 'LNA Gain (dB)', min: 0, max: 15, step: 1, value: 8 },
  { name: 'MIX', label: 'Mixer Gain (dB)', min: 0, max: 15, step: 1, value: 8 },
  { name: 'VGA', label: 'VGA Gain (dB)', min: 0, max: 15, step: 1, value: 8 }
];

export class AirspyBridgeDevice extends BridgeBackedDevice {
  constructor() {
    super({
      sourceType: 'AIRSPY',
      name: 'Airspy (Bridge)',
      bridgePeerId: 'airspy-bridge-peer',
      secret: 'rad-airspy-bridge',
      capabilityDescriptors: [
        { id: 'stream', label: 'IQ stream', enabled: true },
        { id: 'gain', label: 'Gain control', enabled: true },
        { id: 'diag', label: 'Diagnostics', enabled: true }
      ],
      requestedCapabilities: ['stream', 'gain', 'diag'],
      supportedSampleRatesHz: [2_500_000, 3_000_000, 6_000_000, 10_000_000],
      supportedAnalogBandwidthsHz: [2_500_000, 6_000_000, 8_000_000],
      gainStages: AIRSPY_GAINS,
      initialFrequencyHz: 101_100_000,
      initialSampleRateHz: 2_500_000,
      sampleType: 'i16',
      capabilityModelPatch: {
        agcControl: 'supported',
        basebandFilterControl: 'supported',
        loOffsetControl: 'supported'
      }
    });
  }

  getDebugSnapshot(): DeviceDebugSnapshot {
    return {
      driver: 'AirspyBridgeDevice',
      capturedAt: new Date().toISOString(),
      descriptor: {
        vendorId: 0x1d50,
        productId: 0x60a1,
        manufacturerName: 'Airspy',
        productName: this.name
      },
      recentTrace: this.getBridgeTrace().slice(-16).map((entry) => ({
        ts: new Date().toISOString(),
        event: entry
      }))
    };
  }
}
