import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HackRFDevice, resolveHackRfStreamingInterface } from './HackRFDevice';
import type { SDRStreamFrame } from './streamFrame';

type MockUsbDevice = USBDevice & {
  open: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  selectConfiguration: ReturnType<typeof vi.fn>;
  claimInterface: ReturnType<typeof vi.fn>;
  releaseInterface: ReturnType<typeof vi.fn>;
  selectAlternateInterface: ReturnType<typeof vi.fn>;
  controlTransferOut: ReturnType<typeof vi.fn>;
  controlTransferIn: ReturnType<typeof vi.fn>;
  transferIn: ReturnType<typeof vi.fn>;
  clearHalt: ReturnType<typeof vi.fn>;
};

type MockUsbApi = {
  getDevices: ReturnType<typeof vi.fn>;
  requestDevice: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
};

const createDataView = (bytes: number[]): DataView => {
  return new DataView(Uint8Array.from(bytes).buffer);
};

const bufferSourceToDataView = (data: BufferSource | undefined): DataView => {
  if (!data) {
    return new DataView(new ArrayBuffer(0));
  }

  if (data instanceof ArrayBuffer) {
    return new DataView(data);
  }

  return new DataView(data.buffer, data.byteOffset, data.byteLength);
};

const createMockUsbDevice = (overrides?: {
  productId?: number;
  productName?: string;
  controlTransferIn?: (setup: USBControlTransferParameters) => Promise<USBInTransferResult>;
  transferIn?: (endpoint: number, length: number) => Promise<USBInTransferResult>;
}): MockUsbDevice => {
  const bulkAlt = {
    alternateSetting: 0,
    endpoints: [{ direction: 'in', type: 'bulk', endpointNumber: 1, packetSize: 512 }]
  } as unknown as USBAlternateInterface;

  const config = {
    configurationValue: 1,
    interfaces: [{
      interfaceNumber: 0,
      alternate: bulkAlt,
      alternates: [bulkAlt]
    }]
  } as unknown as USBConfiguration;

  const device = {
    vendorId: 0x1d50,
    productId: overrides?.productId ?? 0x6089,
    productName: overrides?.productName ?? 'HackRF One',
    manufacturerName: 'Great Scott Gadgets',
    serialNumber: 'redacted-test',
    opened: false,
    configuration: null,
    open: vi.fn(async function open(this: { opened: boolean }) {
      this.opened = true;
    }),
    close: vi.fn(async function close(this: { opened: boolean }) {
      this.opened = false;
    }),
    selectConfiguration: vi.fn(async function selectConfiguration(this: { configuration: USBConfiguration | null }) {
      this.configuration = config;
    }),
    claimInterface: vi.fn(async () => {}),
    releaseInterface: vi.fn(async () => {}),
    selectAlternateInterface: vi.fn(async () => {}),
    controlTransferOut: vi.fn(async () => ({ status: 'ok', bytesWritten: 0 } as USBOutTransferResult)),
    controlTransferIn: vi.fn(overrides?.controlTransferIn ?? (async (setup: USBControlTransferParameters) => {
      if (setup.request === 14) {
        return { status: 'ok', data: createDataView([2]) } as USBInTransferResult;
      }

      if (setup.request === 15) {
        const bytes = new TextEncoder().encode('2024.02.1\0');
        return { status: 'ok', data: new DataView(bytes.buffer) } as USBInTransferResult;
      }

      return { status: 'ok', data: createDataView([1]) } as USBInTransferResult;
    })),
    transferIn: vi.fn(overrides?.transferIn ?? (async () => {
      return { status: 'ok', data: new DataView(new ArrayBuffer(16_384)) } as USBInTransferResult;
    })),
    clearHalt: vi.fn(async () => {})
  };

  return device as unknown as MockUsbDevice;
};

const installMockNavigatorUsb = (paired: USBDevice[], requestedDevice: USBDevice): MockUsbApi => {
  const usb = {
    getDevices: vi.fn(async () => paired),
    requestDevice: vi.fn(async () => requestedDevice),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  };

  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    writable: true,
    value: { usb }
  });

  return usb as unknown as MockUsbApi;
};

describe('HackRFDevice', () => {
  let originalNavigator: Navigator | undefined;
  let originalWindow: (Window & typeof globalThis) | undefined;

  beforeEach(() => {
    originalNavigator = globalThis.navigator;
    originalWindow = globalThis.window;
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      writable: true,
      value: {
        setTimeout: globalThis.setTimeout.bind(globalThis),
        clearTimeout: globalThis.clearTimeout.bind(globalThis)
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      writable: true,
      value: originalWindow
    });
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      writable: true,
      value: originalNavigator
    });
  });

  it('encodes SET_FREQ payload as MHz + remainder LE uint32', async () => {
    const mockDevice = createMockUsbDevice();
    installMockNavigatorUsb([mockDevice], mockDevice);
    const device = new HackRFDevice();

    await device.open();
    await device.setFrequency(915_200_123);

    const freqCall = mockDevice.controlTransferOut.mock.calls
      .filter((args: unknown[]) => (args[0] as USBControlTransferParameters | undefined)?.request === 16)
      .slice(-1)[0];

    expect(freqCall).toBeDefined();
    const payload = bufferSourceToDataView(freqCall?.[1] as BufferSource);
    expect(payload.getUint32(0, true)).toBe(915);
    expect(payload.getUint32(4, true)).toBe(200_123);
  });

  it('encodes SET_SAMPLE_RATE payload with divider=1', async () => {
    const mockDevice = createMockUsbDevice();
    installMockNavigatorUsb([mockDevice], mockDevice);
    const device = new HackRFDevice();

    await device.open();
    await device.setSampleRate(10_000_000);

    const sampleRateCall = mockDevice.controlTransferOut.mock.calls
      .filter((args: unknown[]) => (args[0] as USBControlTransferParameters | undefined)?.request === 6)
      .slice(-1)[0];

    expect(sampleRateCall).toBeDefined();
    const payload = bufferSourceToDataView(sampleRateCall?.[1] as BufferSource);
    expect(payload.getUint32(0, true)).toBe(10_000_000);
    expect(payload.getUint32(4, true)).toBe(1);
  });

  it('uses control-in for LNA/VGA gains and control-out for AMP', async () => {
    const mockDevice = createMockUsbDevice();
    installMockNavigatorUsb([mockDevice], mockDevice);
    const device = new HackRFDevice();

    await device.open();
    await device.setGain('LNA', 24);
    await device.setGain('VGA', 30);
    await device.setGain('AMP', 1);

    expect(mockDevice.controlTransferIn.mock.calls.some((args: unknown[]) => {
      const setup = args[0] as USBControlTransferParameters | undefined;
      return setup?.request === 19 && setup.index === 24;
    })).toBe(true);

    expect(mockDevice.controlTransferIn.mock.calls.some((args: unknown[]) => {
      const setup = args[0] as USBControlTransferParameters | undefined;
      return setup?.request === 20 && setup.index === 30;
    })).toBe(true);

    expect(mockDevice.controlTransferOut.mock.calls.some((args: unknown[]) => {
      const setup = args[0] as USBControlTransferParameters | undefined;
      return setup?.request === 17 && setup.value === 1;
    })).toBe(true);
  });

  it('recovers a stalled endpoint via clearHalt and continues streaming', async () => {
    let transferAttempt = 0;
    const mockDevice = createMockUsbDevice({
      transferIn: async () => {
        transferAttempt += 1;
        if (transferAttempt === 1) {
          throw new Error('endpoint stall while reading');
        }

        return { status: 'ok', data: new DataView(new ArrayBuffer(16_384)) } as USBInTransferResult;
      }
    });

    installMockNavigatorUsb([mockDevice], mockDevice);
    const device = new HackRFDevice();
    await device.open();

    let frames = 0;
    await device.start(() => {
      frames += 1;
      if (frames === 1) {
        void device.stop();
      }
    });

    const snapshot = device.getDebugSnapshot();
    expect(mockDevice.clearHalt).toHaveBeenCalled();
    expect(snapshot.counters?.stallRecoveryCount).toBeGreaterThanOrEqual(1);
    expect(snapshot.counters?.retryCount).toBeGreaterThanOrEqual(1);
  });

  it('escalates repeated stall storms and aborts after configured retry limit', async () => {
    const mockDevice = createMockUsbDevice({
      transferIn: async () => {
        throw new Error('endpoint stall persists');
      }
    });

    installMockNavigatorUsb([mockDevice], mockDevice);
    const device = new HackRFDevice();
    await device.open();
    await device.setStreamingProfile({
      transferSizeBytes: 16_384,
      retryDelayMs: 5,
      maxConsecutiveFailures: 4,
      profileName: 'custom'
    });

    await expect(device.start(() => {})).rejects.toThrow('aborted after 4 consecutive transfer failures');
    expect(mockDevice.clearHalt.mock.calls.length).toBeGreaterThanOrEqual(4);
    expect(mockDevice.open.mock.calls.length).toBeGreaterThan(1);
  });

  it('escalates to handle reopen when clearHalt fails during stall recovery', async () => {
    let transferAttempt = 0;
    const mockDevice = createMockUsbDevice({
      transferIn: async () => {
        transferAttempt += 1;
        if (transferAttempt === 1) {
          throw new Error('endpoint halted while reading');
        }

        return { status: 'ok', data: new DataView(new ArrayBuffer(16_384)) } as USBInTransferResult;
      }
    });

    mockDevice.clearHalt.mockImplementation(async () => {
      throw new Error('clearHalt endpoint failed');
    });

    installMockNavigatorUsb([mockDevice], mockDevice);
    const device = new HackRFDevice();
    await device.open();

    let frames = 0;
    await device.start(() => {
      frames += 1;
      if (frames === 1) {
        void device.stop();
      }
    });

    const snapshot = device.getDebugSnapshot();
    expect(mockDevice.clearHalt).toHaveBeenCalled();
    expect(mockDevice.open.mock.calls.length).toBeGreaterThan(1);
    expect(snapshot.recentTrace?.some((entry) => entry.event === 'clear-halt-escalate')).toBe(true);
  });

  it('fails early with guided recovery when paired device is in bootloader/DFU personality', async () => {
    const bootloaderDevice = createMockUsbDevice({
      productId: 0x608b,
      productName: 'HackRF DFU Bootloader'
    });
    const normalDevice = createMockUsbDevice();
    const usb = installMockNavigatorUsb([bootloaderDevice], normalDevice);
    const device = new HackRFDevice();

    await expect(device.open()).rejects.toThrow('Detected HackRF in bootloader/DFU mode');
    expect(usb.requestDevice).not.toHaveBeenCalled();
  });

  it('marks compatibility as unsupported when firmware probe indicates bootloader personality', async () => {
    const mockDevice = createMockUsbDevice({
      controlTransferIn: async (setup: USBControlTransferParameters) => {
        if (setup.request === 14) {
          return { status: 'ok', data: createDataView([2]) } as USBInTransferResult;
        }

        if (setup.request === 15) {
          const bytes = new TextEncoder().encode('HackRF DFU bootloader\0');
          return { status: 'ok', data: new DataView(bytes.buffer) } as USBInTransferResult;
        }

        return { status: 'ok', data: createDataView([1]) } as USBInTransferResult;
      }
    });

    installMockNavigatorUsb([mockDevice], mockDevice);
    const device = new HackRFDevice();
    await device.open();

    const snapshot = device.getDebugSnapshot();
    expect(snapshot.compatibility?.status).toBe('known-unsupported');
    expect(snapshot.compatibility?.note).toContain('DFU/bootloader mode');
  });

  it('blocks streaming start when compatibility status is known-unsupported', async () => {
    const mockDevice = createMockUsbDevice({
      controlTransferIn: async (setup: USBControlTransferParameters) => {
        if (setup.request === 14) {
          return { status: 'ok', data: createDataView([2]) } as USBInTransferResult;
        }

        if (setup.request === 15) {
          const bytes = new TextEncoder().encode('2016.01.0\0');
          return { status: 'ok', data: new DataView(bytes.buffer) } as USBInTransferResult;
        }

        return { status: 'ok', data: createDataView([1]) } as USBInTransferResult;
      }
    });

    installMockNavigatorUsb([mockDevice], mockDevice);
    const device = new HackRFDevice();
    await device.open();

    await expect(device.start(() => {})).rejects.toThrow(/compatibility gate/i);
    expect(device.getStateMachineSnapshot().state).toBe('error');
  });

  it('gates unknown compatibility low-latency profile requests to balanced', async () => {
    const mockDevice = createMockUsbDevice({
      controlTransferIn: async (setup: USBControlTransferParameters) => {
        if (setup.request === 14) {
          return { status: 'ok', data: createDataView([2]) } as USBInTransferResult;
        }

        if (setup.request === 15) {
          const bytes = new TextEncoder().encode('2025.11.0\0');
          return { status: 'ok', data: new DataView(bytes.buffer) } as USBInTransferResult;
        }

        return { status: 'ok', data: createDataView([1]) } as USBInTransferResult;
      }
    });

    installMockNavigatorUsb([mockDevice], mockDevice);
    const device = new HackRFDevice();
    await device.open();

    await device.setStreamingProfile({
      transferSizeBytes: 8_192,
      retryDelayMs: 10,
      maxConsecutiveFailures: 6,
      profileName: 'low-latency'
    });

    const snapshot = device.getDebugSnapshot();
    expect(snapshot.compatibility?.status).toBe('unknown');
    expect(snapshot.streamingProfile?.profileName).toBe('balanced');
  });

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
    expect(capability.rfPower.biasTee).toBe('supported');
    expect(capability.rfPower.gpioControl).toBe('unsupported');
    expect(capability.iqControl.swap).toBe('unsupported');
    expect(capability.frontEndCorrection.dcOffset).toBe('unsupported');
  });

  it('applies RF power state via antenna-enable command and tracks amp mirror state', async () => {
    const mockDevice = createMockUsbDevice();
    installMockNavigatorUsb([mockDevice], mockDevice);
    const device = new HackRFDevice();

    await device.open();
    await device.setRfPowerState({ biasTeeEnabled: true, ampEnabled: true });

    expect(mockDevice.controlTransferOut.mock.calls.some((args: unknown[]) => {
      const setup = args[0] as USBControlTransferParameters | undefined;
      return setup?.request === 23 && setup.value === 1;
    })).toBe(true);

    expect(mockDevice.controlTransferOut.mock.calls.some((args: unknown[]) => {
      const setup = args[0] as USBControlTransferParameters | undefined;
      return setup?.request === 17 && setup.value === 1;
    })).toBe(true);

    const powerState = device.getRfPowerState();
    expect(powerState.biasTeeEnabled).toBe(true);
    expect(powerState.ampEnabled).toBe(true);
  });

  it('rejects GPIO control patches because HackRF WebUSB GPIO path is not implemented', async () => {
    const device = new HackRFDevice();
    await expect(device.setGpioState({ outputPins: { GPIO0: true } })).rejects.toThrow(/does not currently support GPIO/i);
  });

  it('reports explicit stream continuity and state machine contracts', () => {
    const device = new HackRFDevice();
    const continuity = device.getStreamContinuityContract();
    const state = device.getStateMachineSnapshot();

    expect(continuity.timestampModel).toBe('monotonic-with-explicit-gaps');
    expect(continuity.discontinuityOperations.some((entry) => entry.operation === 'retune' && entry.cause === 'retune')).toBe(true);
    expect(continuity.emittedDiscontinuityCauses).toContain('dropped_samples');
    expect(state.state).toBe('idle');
    expect(state.transitionCount).toBeGreaterThanOrEqual(0);
  });

  it('rejects unsupported IQ/DC/front-end toggles when enabling', async () => {
    const device = new HackRFDevice();

    await expect(device.setIqControlState({ swapEnabled: true })).rejects.toThrow(/does not support/i);
    await expect(device.setFrontEndCorrectionState({ dcOffsetEnabled: true })).rejects.toThrow(/does not support/i);

    await expect(device.setIqControlState({ swapEnabled: false, invertEnabled: false })).resolves.toBeUndefined();
    await expect(device.setFrontEndCorrectionState({ dcOffsetEnabled: false, iqBalanceEnabled: false })).resolves.toBeUndefined();
  });

  it('enforces continuity math and emits retune/sample-rate discontinuities while streaming', async () => {
    const mockDevice = createMockUsbDevice({
      transferIn: async () => {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 0);
        });
        return { status: 'ok', data: new DataView(new ArrayBuffer(16_384)) } as USBInTransferResult;
      }
    });

    installMockNavigatorUsb([mockDevice], mockDevice);
    const device = new HackRFDevice();
    await device.open();

    const frames: SDRStreamFrame[] = [];
    await device.start((_data, frame) => {
      if (!frame) {
        return;
      }

      frames.push(frame);
      if (frames.length === 1) {
        void device.setFrequency(101_700_000);
      }

      if (frames.length === 2) {
        void device.setSampleRate(5_000_000);
      }

      if (frames.length >= 6) {
        void device.stop();
      }
    });

    expect(frames.length).toBeGreaterThanOrEqual(3);
    expect(frames[0].discontinuity?.cause).toBe('restart');

    for (let i = 1; i < frames.length; i += 1) {
      const prev = frames[i - 1];
      const current = frames[i];

      expect(current.sequence).toBe(prev.sequence + 1);
      expect(current.sampleIndex).toBe(prev.sampleIndex + prev.sampleCount + current.droppedSamples);
      expect(current.timestampNs).toBeGreaterThan(prev.timestampNs);
    }

    expect(frames.some((frame) => frame.discontinuity?.cause === 'retune')).toBe(true);
    expect(frames.some((frame) => frame.discontinuity?.cause === 'sample_rate_change')).toBe(true);
  });

  it('selects a robust descriptor endpoint candidate and records warnings', () => {
    const config = {
      interfaces: [
        {
          interfaceNumber: 3,
          alternate: { alternateSetting: 0 },
          alternates: [
            {
              alternateSetting: 0,
              endpoints: [
                { direction: 'in', type: 'bulk', endpointNumber: 2, packetSize: 64 },
                { direction: 'in', type: 'bulk', endpointNumber: 1, packetSize: 512 }
              ]
            }
          ]
        },
        {
          interfaceNumber: 0,
          alternate: { alternateSetting: 0 },
          alternates: [
            {
              alternateSetting: 0,
              endpoints: [
                { direction: 'in', type: 'bulk', endpointNumber: 5, packetSize: 1024 }
              ]
            }
          ]
        }
      ]
    } as unknown as USBConfiguration;

    const selected = resolveHackRfStreamingInterface(config);
    expect(selected.interfaceIndex).toBe(0);
    expect(selected.inEndpointNumber).toBe(5);
    expect(selected.candidateCount).toBe(2);
    expect(selected.warnings.length).toBeGreaterThan(0);
  });

  it('throws when descriptor has no bulk-in endpoint candidates', () => {
    const config = {
      interfaces: [
        {
          interfaceNumber: 0,
          alternate: { alternateSetting: 0 },
          alternates: [
            {
              alternateSetting: 0,
              endpoints: [{ direction: 'out', type: 'bulk', endpointNumber: 1, packetSize: 64 }]
            }
          ]
        }
      ]
    } as unknown as USBConfiguration;

    expect(() => resolveHackRfStreamingInterface(config)).toThrow(/no bulk-in IQ endpoint/i);
  });
});
