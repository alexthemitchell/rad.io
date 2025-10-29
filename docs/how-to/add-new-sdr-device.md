# How-To: Add a New SDR Device

This guide walks you through implementing support for a new SDR hardware device in rad.io. You'll learn the device integration pattern and how to implement the required interfaces.

**Time to complete**: 2-3 hours  
**Prerequisites**: TypeScript knowledge, familiarity with WebUSB API  
**Difficulty**: Intermediate

## Overview

Adding a new SDR device involves:
1. Implementing the `ISDRDevice` interface
2. Creating WebUSB descriptors
3. Writing device-specific command protocols
4. Adding tests
5. Integrating with the UI

## Step 1: Understand the Device Interface

All SDR devices implement the `ISDRDevice` interface from `src/models/interfaces.ts`:

```typescript
export interface ISDRDevice {
  // Connection management
  open(): Promise<void>;
  close(): Promise<void>;
  isOpen(): boolean;

  // Device control
  setFrequency(frequency: number): Promise<void>;
  setSampleRate(sampleRate: number): Promise<void>;
  setGain(gain: number): Promise<void>;
  
  // Data streaming
  startReceiving(): Promise<void>;
  stopReceiving(): Promise<void>;
  
  // Data callback
  onData(callback: (samples: IQSample[]) => void): void;
  
  // Device info
  getName(): string;
  getCapabilities(): DeviceCapabilities;
}
```

## Step 2: Create Your Device Class

Create a new file: `src/models/YourDevice.ts`

```typescript
import { ISDRDevice, IQSample, DeviceCapabilities } from './interfaces';

/**
 * Driver for YourDevice SDR.
 * 
 * Vendor: YourCompany
 * USB VID: 0x1234
 * USB PID: 0x5678
 * Frequency Range: 50 MHz - 2 GHz
 * Max Sample Rate: 20 MS/s
 */
export class YourDevice implements ISDRDevice {
  private usbDevice: USBDevice;
  private isDeviceOpen = false;
  private isReceiving = false;
  private dataCallback?: (samples: IQSample[]) => void;
  private transferLoop?: Promise<void>;

  // Device-specific constants
  private static readonly USB_VENDOR_ID = 0x1234;
  private static readonly USB_PRODUCT_ID = 0x5678;
  private static readonly INTERFACE_NUMBER = 0;
  private static readonly ENDPOINT_IN = 1; // Bulk IN endpoint
  
  constructor(usbDevice: USBDevice) {
    this.usbDevice = usbDevice;
  }

  async open(): Promise<void> {
    if (this.isDeviceOpen) {
      throw new Error('Device already open');
    }

    try {
      await this.usbDevice.open();
      await this.usbDevice.selectConfiguration(1);
      await this.usbDevice.claimInterface(YourDevice.INTERFACE_NUMBER);
      
      // Initialize device (device-specific)
      await this.initializeDevice();
      
      this.isDeviceOpen = true;
    } catch (error) {
      throw new Error(`Failed to open device: ${error}`);
    }
  }

  async close(): Promise<void> {
    if (!this.isDeviceOpen) return;

    try {
      await this.stopReceiving();
      await this.usbDevice.releaseInterface(YourDevice.INTERFACE_NUMBER);
      await this.usbDevice.close();
      this.isDeviceOpen = false;
    } catch (error) {
      console.error('Error closing device:', error);
    }
  }

  isOpen(): boolean {
    return this.isDeviceOpen;
  }

  async setFrequency(frequency: number): Promise<void> {
    this.validateOpen();
    
    // Validate frequency range
    const caps = this.getCapabilities();
    if (frequency < caps.minFrequency || frequency > caps.maxFrequency) {
      throw new Error(
        `Frequency ${frequency} Hz out of range ` +
        `(${caps.minFrequency}-${caps.maxFrequency} Hz)`
      );
    }

    // Send device-specific command
    await this.sendCommand({
      command: 'SET_FREQ',
      value: frequency,
    });
  }

  async setSampleRate(sampleRate: number): Promise<void> {
    this.validateOpen();
    
    const caps = this.getCapabilities();
    if (!caps.supportedSampleRates.includes(sampleRate)) {
      throw new Error(`Sample rate ${sampleRate} not supported`);
    }

    await this.sendCommand({
      command: 'SET_SAMPLE_RATE',
      value: sampleRate,
    });
  }

  async setGain(gain: number): Promise<void> {
    this.validateOpen();
    
    // Clamp to valid range
    const clampedGain = Math.max(0, Math.min(gain, 50));
    
    await this.sendCommand({
      command: 'SET_GAIN',
      value: clampedGain,
    });
  }

  async startReceiving(): Promise<void> {
    this.validateOpen();
    
    if (this.isReceiving) {
      throw new Error('Already receiving');
    }

    await this.sendCommand({ command: 'START_RX' });
    this.isReceiving = true;
    this.transferLoop = this.startTransferLoop();
  }

  async stopReceiving(): Promise<void> {
    if (!this.isReceiving) return;

    this.isReceiving = false;
    await this.transferLoop; // Wait for loop to finish
    await this.sendCommand({ command: 'STOP_RX' });
  }

  onData(callback: (samples: IQSample[]) => void): void {
    this.dataCallback = callback;
  }

  getName(): string {
    return 'YourDevice SDR';
  }

  getCapabilities(): DeviceCapabilities {
    return {
      minFrequency: 50e6,      // 50 MHz
      maxFrequency: 2e9,       // 2 GHz
      supportedSampleRates: [
        1e6,   // 1 MS/s
        2e6,   // 2 MS/s
        5e6,   // 5 MS/s
        10e6,  // 10 MS/s
        20e6,  // 20 MS/s
      ],
      maxGain: 50,
      hasAmplifier: true,
      hasAntennaPower: false,
    };
  }

  // Private helper methods

  private validateOpen(): void {
    if (!this.isDeviceOpen) {
      throw new Error('Device not open');
    }
  }

  private async initializeDevice(): Promise<void> {
    // Device-specific initialization
    // Read device info, set defaults, etc.
    
    // Example: Read firmware version
    const version = await this.readFirmwareVersion();
    console.log(`YourDevice firmware version: ${version}`);
  }

  private async sendCommand(command: DeviceCommand): Promise<void> {
    // Convert command to device-specific protocol
    const buffer = this.encodeCommand(command);
    
    // Send via control transfer
    await this.usbDevice.controlTransferOut({
      requestType: 'vendor',
      recipient: 'device',
      request: command.command === 'SET_FREQ' ? 0x01 : 0x02,
      value: 0,
      index: 0,
    }, buffer);
  }

  private encodeCommand(command: DeviceCommand): ArrayBuffer {
    // Device-specific command encoding
    const buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);
    
    switch (command.command) {
      case 'SET_FREQ':
        // Encode frequency (example: 64-bit little-endian)
        view.setBigUint64(0, BigInt(command.value), true);
        break;
      // ... other commands
    }
    
    return buffer;
  }

  private async startTransferLoop(): Promise<void> {
    const bufferSize = 262144; // 256 KB

    while (this.isReceiving) {
      try {
        const result = await this.usbDevice.transferIn(
          YourDevice.ENDPOINT_IN,
          bufferSize
        );

        if (result.status === 'ok' && result.data) {
          const samples = this.parseIQData(result.data);
          if (this.dataCallback) {
            this.dataCallback(samples);
          }
        }
      } catch (error) {
        console.error('Transfer error:', error);
        this.isReceiving = false;
        break;
      }
    }
  }

  private parseIQData(data: DataView): IQSample[] {
    // Device-specific data format parsing
    // Common formats:
    // - Signed 8-bit I/Q pairs
    // - Signed 16-bit I/Q pairs
    // - Float32 I/Q pairs
    
    const samples: IQSample[] = [];
    
    // Example: 8-bit signed I/Q
    for (let i = 0; i < data.byteLength; i += 2) {
      const i_val = data.getInt8(i) / 127.0;
      const q_val = data.getInt8(i + 1) / 127.0;
      samples.push({ i: i_val, q: q_val });
    }
    
    return samples;
  }

  private async readFirmwareVersion(): Promise<string> {
    // Device-specific version read
    const result = await this.usbDevice.controlTransferIn({
      requestType: 'vendor',
      recipient: 'device',
      request: 0xFF, // GET_VERSION command
      value: 0,
      index: 0,
    }, 16);

    if (result.status === 'ok' && result.data) {
      const decoder = new TextDecoder();
      return decoder.decode(result.data);
    }
    
    return 'unknown';
  }

  /**
   * Static method to request device from user.
   * Called by UI to trigger browser's device picker.
   */
  static async requestDevice(): Promise<YourDevice> {
    try {
      const device = await navigator.usb.requestDevice({
        filters: [{
          vendorId: YourDevice.USB_VENDOR_ID,
          productId: YourDevice.USB_PRODUCT_ID,
        }],
      });
      return new YourDevice(device);
    } catch (error) {
      throw new Error(`Failed to request device: ${error}`);
    }
  }
}

// Internal types
interface DeviceCommand {
  command: 'SET_FREQ' | 'SET_SAMPLE_RATE' | 'SET_GAIN' | 'START_RX' | 'STOP_RX';
  value?: number;
}
```

## Step 3: Add Tests

Create `src/models/__tests__/YourDevice.test.ts`:

```typescript
import { YourDevice } from '../YourDevice';

describe('YourDevice', () => {
  let mockUSBDevice: any;
  let device: YourDevice;

  beforeEach(() => {
    // Mock USB device
    mockUSBDevice = {
      open: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      selectConfiguration: jest.fn().mockResolvedValue(undefined),
      claimInterface: jest.fn().mockResolvedValue(undefined),
      releaseInterface: jest.fn().mockResolvedValue(undefined),
      controlTransferOut: jest.fn().mockResolvedValue({}),
      controlTransferIn: jest.fn().mockResolvedValue({
        status: 'ok',
        data: new DataView(new ArrayBuffer(16)),
      }),
      transferIn: jest.fn().mockResolvedValue({
        status: 'ok',
        data: new DataView(new ArrayBuffer(1024)),
      }),
    };

    device = new YourDevice(mockUSBDevice);
  });

  describe('open', () => {
    it('should open device successfully', async () => {
      await device.open();
      
      expect(mockUSBDevice.open).toHaveBeenCalled();
      expect(mockUSBDevice.selectConfiguration).toHaveBeenCalledWith(1);
      expect(mockUSBDevice.claimInterface).toHaveBeenCalledWith(0);
      expect(device.isOpen()).toBe(true);
    });

    it('should throw if already open', async () => {
      await device.open();
      await expect(device.open()).rejects.toThrow('already open');
    });
  });

  describe('setFrequency', () => {
    beforeEach(async () => {
      await device.open();
    });

    it('should set valid frequency', async () => {
      await device.setFrequency(100e6);
      expect(mockUSBDevice.controlTransferOut).toHaveBeenCalled();
    });

    it('should reject frequency out of range', async () => {
      await expect(device.setFrequency(10e6)).rejects.toThrow('out of range');
      await expect(device.setFrequency(3e9)).rejects.toThrow('out of range');
    });

    it('should throw if device not open', async () => {
      const closedDevice = new YourDevice(mockUSBDevice);
      await expect(closedDevice.setFrequency(100e6)).rejects.toThrow('not open');
    });
  });

  describe('data streaming', () => {
    beforeEach(async () => {
      await device.open();
    });

    it('should start and stop receiving', async () => {
      await device.startReceiving();
      await device.stopReceiving();
      
      expect(mockUSBDevice.controlTransferOut).toHaveBeenCalledTimes(4); // init + start + stop
    });

    it('should call data callback with samples', async () => {
      const dataCallback = jest.fn();
      device.onData(dataCallback);
      
      await device.startReceiving();
      
      // Wait for at least one transfer
      await new Promise(resolve => setTimeout(resolve, 100));
      await device.stopReceiving();
      
      expect(dataCallback).toHaveBeenCalled();
      expect(dataCallback.mock.calls[0][0]).toBeInstanceOf(Array);
    });
  });
});
```

## Step 4: Create a Device Hook

Create `src/hooks/useYourDevice.ts`:

```typescript
import { useState, useCallback, useEffect } from 'react';
import { YourDevice } from '../models/YourDevice';
import { IQSample } from '../models/interfaces';

export function useYourDevice() {
  const [device, setDevice] = useState<YourDevice | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [samples, setSamples] = useState<IQSample[]>([]);

  const connectDevice = useCallback(async () => {
    try {
      const dev = await YourDevice.requestDevice();
      await dev.open();
      
      dev.onData((newSamples) => {
        setSamples(newSamples);
      });
      
      setDevice(dev);
      setIsOpen(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, []);

  const disconnectDevice = useCallback(async () => {
    if (device) {
      await device.close();
      setDevice(null);
      setIsOpen(false);
    }
  }, [device]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (device && device.isOpen()) {
        device.close();
      }
    };
  }, [device]);

  return {
    device,
    isOpen,
    error,
    samples,
    connectDevice,
    disconnectDevice,
  };
}
```

## Step 5: Update Device Registry

Add your device to `src/models/index.ts`:

```typescript
export { YourDevice } from './YourDevice';
export { useYourDevice } from '../hooks/useYourDevice';
```

## Step 6: Add to UI

In your device selector component, add the new device option:

```typescript
import { YourDevice } from '../models';

// In your device selection UI:
<button onClick={async () => {
  const device = await YourDevice.requestDevice();
  // ... handle device
}}>
  Connect YourDevice
</button>
```

## Step 7: Update Documentation

1. Add to README.md supported devices list
2. Create troubleshooting guide: `docs/reference/yourdevice-troubleshooting.md`
3. Update ARCHITECTURE.md with device-specific details

## Testing Your Device

### Unit Tests
```bash
npm test -- YourDevice.test.ts
```

### Manual Testing
1. Connect your hardware
2. Start dev server: `npm start`
3. Click "Connect YourDevice"
4. Verify:
   - Device connects
   - Frequency setting works
   - Data streaming works
   - Visualizations update

### Common Issues

**Device not detected:**
- Check USB VID/PID match your hardware
- Verify device has correct permissions (Linux: udev rules)
- Check browser supports WebUSB

**Transfer errors:**
- Verify endpoint numbers
- Check buffer sizes
- Validate data format parsing

**Performance problems:**
- Use larger transfer buffers
- Optimize data parsing
- Consider WebAssembly for parsing

## Best Practices

✅ **DO:**
- Validate all parameters
- Handle USB errors gracefully
- Clean up resources in `close()`
- Add comprehensive tests
- Document device-specific quirks

❌ **DON'T:**
- Block the UI thread with long operations
- Ignore USB transfer errors
- Leave device in invalid state
- Hardcode magic numbers (use constants)

## Next Steps

- Read [Hardware Integration Reference](../reference/hardware-integration.md)
- See [HackRF implementation](../../src/models/HackRFOne.ts) for complete example
- Check [WebUSB API docs](https://developer.mozilla.org/en-US/docs/Web/API/USB)

## Need Help?

- Ask in [GitHub Discussions](https://github.com/alexthemitchell/rad.io/discussions)
- Check [WebUSB debugging guide](./debug-webusb.md)
- Review existing device implementations
