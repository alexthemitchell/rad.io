import type { DeviceDebugSnapshot, SDRGainStage } from './ISDRDevice';
import { BridgeBackedDevice } from './bridge/BridgeBackedDevice';

const SDRPLAY_GAINS: SDRGainStage[] = [
  { name: 'LNA', label: 'LNA State', min: 0, max: 9, step: 1, value: 4 },
  { name: 'IF', label: 'IF Gain (dB)', min: 20, max: 59, step: 1, value: 40 }
];

export class SdrplayBridgeDevice extends BridgeBackedDevice {
  constructor() {
    super({
      sourceType: 'SDRPLAY',
      name: 'SDRplay RSP (Bridge)',
      bridgePeerId: 'sdrplay-bridge-peer',
      secret: 'rad-sdrplay-bridge',
      capabilityDescriptors: [
        { id: 'stream', label: 'IQ stream', enabled: true },
        { id: 'gain', label: 'Gain control', enabled: true },
        { id: 'bias-tee', label: 'Bias Tee', enabled: true },
        { id: 'diag', label: 'Diagnostics', enabled: true }
      ],
      requestedCapabilities: ['stream', 'gain', 'bias-tee', 'diag'],
      supportedSampleRatesHz: [2_000_000, 4_000_000, 6_000_000, 8_000_000],
      supportedAnalogBandwidthsHz: [1_536_000, 5_000_000, 6_000_000, 8_000_000],
      gainStages: SDRPLAY_GAINS,
      initialFrequencyHz: 100_000_000,
      initialSampleRateHz: 2_000_000,
      sampleType: 'i16',
      capabilityModelPatch: {
        agcControl: 'supported',
        rfPower: {
          biasTee: 'supported',
          ampControl: 'unsupported',
          gpioControl: 'unknown'
        }
      }
    });
  }

  getDebugSnapshot(): DeviceDebugSnapshot {
    return {
      driver: 'SdrplayBridgeDevice',
      capturedAt: new Date().toISOString(),
      descriptor: {
        vendorId: 0x1df7,
        productId: 0x2500,
        manufacturerName: 'SDRplay',
        productName: this.name
      },
      recentTrace: this.getBridgeTrace().slice(-16).map((entry) => ({
        ts: new Date().toISOString(),
        event: entry
      }))
    };
  }
}
