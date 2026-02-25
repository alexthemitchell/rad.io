import type { DeviceDebugSnapshot, SDRGainStage } from './ISDRDevice';
import { BridgeBackedDevice } from './bridge/BridgeBackedDevice';

const PLUTO_GAINS: SDRGainStage[] = [
  { name: 'RX_GAIN', label: 'RX Hardware Gain (dB)', min: -3, max: 73, step: 1, value: 35 }
];

export class PlutoSdrBridgeDevice extends BridgeBackedDevice {
  constructor() {
    super({
      sourceType: 'PLUTO',
      name: 'PlutoSDR (Bridge)',
      bridgePeerId: 'pluto-bridge-peer',
      secret: 'rad-pluto-bridge',
      capabilityDescriptors: [
        { id: 'stream', label: 'IQ stream', enabled: true },
        { id: 'gain', label: 'Gain control', enabled: true },
        { id: 'network-link', label: 'Network transport', enabled: true },
        { id: 'diag', label: 'Diagnostics', enabled: true }
      ],
      requestedCapabilities: ['stream', 'gain', 'network-link', 'diag'],
      supportedSampleRatesHz: [520_834, 1_000_000, 2_500_000, 5_000_000],
      supportedAnalogBandwidthsHz: [200_000, 1_500_000, 5_000_000],
      gainStages: PLUTO_GAINS,
      initialFrequencyHz: 100_000_000,
      initialSampleRateHz: 1_000_000,
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
      driver: 'PlutoSdrBridgeDevice',
      capturedAt: new Date().toISOString(),
      descriptor: {
        vendorId: 0x0456,
        productId: 0xb673,
        manufacturerName: 'Analog Devices',
        productName: this.name
      },
      recentTrace: this.getBridgeTrace().slice(-16).map((entry) => ({
        ts: new Date().toISOString(),
        event: entry
      }))
    };
  }
}
