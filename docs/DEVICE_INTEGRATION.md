# Device Integration Guide

This guide provides step-by-step instructions for integrating new SDR hardware into rad.io. By following this guide, you'll create a fully functional device implementation that works seamlessly with the existing application.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Step-by-Step Integration](#step-by-step-integration)
4. [Device Template](#device-template)
5. [Testing Your Device](#testing-your-device)
6. [Common Patterns](#common-patterns)
7. [Troubleshooting](#troubleshooting)

## Prerequisites

Before integrating a new device, ensure you have:

- **Device Documentation**: USB vendor/product IDs, control commands, sample format
- **Physical Hardware**: The actual SDR device for testing
- **Development Environment**: Node.js, npm, and a WebUSB-compatible browser (Chrome/Edge)
- **TypeScript Knowledge**: Familiarity with TypeScript and async/await patterns
- **USB Protocol Understanding**: Basic knowledge of USB bulk and control transfers

### Required Device Information

Gather the following information about your device:

1. **USB Identifiers**:
   - Vendor ID (e.g., `0x1d50`)
   - Product ID (e.g., `0x6089`)
2. **Device Capabilities**:
   - Frequency range (min/max Hz)
   - Supported sample rates
   - Gain ranges (LNA, VGA if applicable)
   - Bandwidth options (if configurable)

3. **USB Configuration**:
   - Configuration number (usually 1)
   - Interface number (usually 0)
   - Endpoint numbers for data transfers

4. **Sample Format**:
   - Data type (Int8, Uint8, Int16, etc.)
   - Sample layout (interleaved I/Q, separate, etc.)
   - Byte order (little-endian, big-endian)

5. **Control Commands**:
   - Command codes for frequency, sample rate, gain control
   - Parameter formats and byte order

## Quick Start

For experienced developers, here's the minimal workflow:

\`\`\`bash

# 1. Copy device template

cp src/models/templates/DeviceTemplate.ts src/models/MyDevice.ts

# 2. Implement required methods

# Edit src/models/MyDevice.ts

# 3. Create adapter (if needed)

# Create src/models/MyDeviceAdapter.ts

# 4. Add USB filter to SDRDevice.ts

# Edit src/models/SDRDevice.ts - add to SDR_USB_DEVICES

# 5. Create device hook

# Create src/hooks/useMyDevice.ts

# 6. Add tests

# Create src/models/**tests**/MyDevice.test.ts

# 7. Run tests

npm test

# 8. Update UI to include new device

# Edit src/pages/Visualizer.tsx or device selection component

\`\`\`

## Step-by-Step Integration

### Step 1: Create Device Implementation

Create a new file \`src/models/YourDevice.ts\` based on your device's API.

**Example: RTL-SDR Device**

\`\`\`typescript
/\*\*

- RTL-SDR USB Device Implementation
-
- Supports RTL2832U-based devices with tuner chips like R820T/R820T2
- Frequency range: 24 MHz - 1766 MHz
- Sample rates: 225 kHz - 3.2 MHz
  \*/

export class RTLSDRDevice {
private device: USBDevice;
private streaming = false;
private closing = false;
private frequency = 100e6; // 100 MHz default
private sampleRate = 2.048e6; // 2.048 MSPS default
private gain = 0;

// USB configuration
private readonly CONFIG_NUM = 1;
private readonly INTERFACE_NUM = 0;
private readonly ENDPOINT_IN = 1; // Bulk IN endpoint for I/Q data

// Control commands for RTL2832U
private readonly CMD_SET_FREQ = 0x05;
private readonly CMD_SET_SAMPLE_RATE = 0x02;
private readonly CMD_SET_GAIN = 0x0d;
private readonly CMD_SET_GAIN_MODE = 0x03;

constructor(usbDevice: USBDevice) {
this.device = usbDevice;
}

async open(): Promise<void> {
if (!this.device.opened) {
await this.device.open();
}

    await this.device.selectConfiguration(this.CONFIG_NUM);
    await this.device.claimInterface(this.INTERFACE_NUM);

    // Initialize device
    await this.initialize();

}

private async initialize(): Promise<void> {
// Reset device
await this.writeRegister(0x01, 0x00);

    // Set default configuration
    await this.setSampleRate(this.sampleRate);
    await this.setFrequency(this.frequency);
    await this.setGain(this.gain);

}

async close(): Promise<void> {
if (this.closing) return;
this.closing = true;

    try {
      await this.stopRx();
      await this.device.releaseInterface(this.INTERFACE_NUM);
      await this.device.close();
    } catch (err) {
      console.error('RTL-SDR close error:', err);
    } finally {
      this.closing = false;
    }

}

isOpen(): boolean {
return this.device.opened;
}

async setFrequency(frequencyHz: number): Promise<void> {
if (frequencyHz < 24e6 || frequencyHz > 1766e6) {
throw new Error(\`Frequency \${frequencyHz / 1e6} MHz out of range (24-1766 MHz)\`);
}

    // Convert frequency to device format (Hz as 32-bit integer)
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setUint32(0, Math.floor(frequencyHz), true);  // Little-endian

    await this.device.controlTransferOut({
      requestType: 'vendor',
      recipient: 'device',
      request: this.CMD_SET_FREQ,
      value: 0,
      index: 0,
    }, buffer);

    this.frequency = frequencyHz;
    console.debug('RTL-SDR frequency set:', frequencyHz / 1e6, 'MHz');

}

async getFrequency(): Promise<number> {
return this.frequency;
}

async setSampleRate(sampleRateHz: number): Promise<void> {
if (sampleRateHz < 225e3 || sampleRateHz > 3.2e6) {
throw new Error(\`Sample rate \${sampleRateHz / 1e6} MSPS out of range (0.225-3.2 MSPS)\`);
}

    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setUint32(0, Math.floor(sampleRateHz), true);

    await this.device.controlTransferOut({
      requestType: 'vendor',
      recipient: 'device',
      request: this.CMD_SET_SAMPLE_RATE,
      value: 0,
      index: 0,
    }, buffer);

    this.sampleRate = sampleRateHz;
    console.debug('RTL-SDR sample rate set:', sampleRateHz / 1e6, 'MSPS');

}

async getSampleRate(): Promise<number> {
return this.sampleRate;
}

async setGain(gainDb: number): Promise<void> {
// RTL-SDR uses tenths of dB (e.g., 10 = 1.0 dB)
const gainTenthsDb = Math.floor(gainDb \* 10);

    // Set manual gain mode
    await this.device.controlTransferOut({
      requestType: 'vendor',
      recipient: 'device',
      request: this.CMD_SET_GAIN_MODE,
      value: 1,  // Manual mode
      index: 0,
    });

    // Set gain value
    await this.device.controlTransferOut({
      requestType: 'vendor',
      recipient: 'device',
      request: this.CMD_SET_GAIN,
      value: gainTenthsDb,
      index: 0,
    });

    this.gain = gainDb;
    console.debug('RTL-SDR gain set:', gainDb, 'dB');

}

async receive(callback: (samples: IQSample[]) => void): Promise<void> {
if (this.streaming) {
throw new Error('Already streaming');
}

    this.streaming = true;
    const BUFFER_SIZE = 16384;  // 16KB buffer

    try {
      while (this.streaming && !this.closing) {
        const result = await this.device.transferIn(this.ENDPOINT_IN, BUFFER_SIZE);

        if (result.data && result.data.byteLength > 0) {
          const samples = this.parseSamples(new DataView(result.data.buffer));
          callback(samples);
        }
      }
    } catch (err) {
      console.error('RTL-SDR streaming error:', err);
      this.streaming = false;
      throw err;
    }

}

async stopRx(): Promise<void> {
this.streaming = false;
}

isReceiving(): boolean {
return this.streaming;
}

parseSamples(data: DataView): IQSample[] {
// RTL-SDR uses unsigned 8-bit samples with 127 offset
// Format: [I, Q, I, Q, ...] where values are 0-255
const samples: IQSample[] = [];

    for (let i = 0; i < data.byteLength; i += 2) {
      const I = (data.getUint8(i) - 127) / 128.0;
      const Q = (data.getUint8(i + 1) - 127) / 128.0;
      samples.push({ I, Q });
    }

    return samples;

}

// Helper method for register writes
private async writeRegister(reg: number, value: number): Promise<void> {
const buffer = new ArrayBuffer(1);
const view = new DataView(buffer);
view.setUint8(0, value);

    await this.device.controlTransferOut({
      requestType: 'vendor',
      recipient: 'device',
      request: 0x10,  // Write register command
      value: reg,
      index: 0,
    }, buffer);

}
}
\`\`\`

### Step 2: Create ISDRDevice Adapter

Create an adapter to conform to the \`ISDRDevice\` interface:

\`\`\`typescript
// src/models/RTLSDRDeviceAdapter.ts

import {
ISDRDevice,
SDRDeviceInfo,
SDRCapabilities,
IQSample,
IQSampleCallback,
DeviceMemoryInfo,
SDRStreamConfig
} from './SDRDevice';
import { RTLSDRDevice } from './RTLSDRDevice';

/\*\*

- Adapter that wraps RTLSDRDevice to implement ISDRDevice interface
  \*/
  export class RTLSDRDeviceAdapter implements ISDRDevice {
  private device: RTLSDRDevice;
  private activeBuffers: DataView[] = [];

constructor(usbDevice: USBDevice) {
this.device = new RTLSDRDevice(usbDevice);
}

async getDeviceInfo(): Promise<SDRDeviceInfo> {
return {
type: 'RTL-SDR',
name: 'RTL-SDR (RTL2832U)',
serialNumber: undefined, // RTL-SDR doesn't expose serial
firmwareVersion: undefined,
hardwareRevision: undefined,
};
}

getCapabilities(): SDRCapabilities {
return {
frequencyRange: { min: 24e6, max: 1766e6 },
sampleRates: [
225e3, // 225 kHz
900e3, // 900 kHz
1.024e6, // 1.024 MHz
1.4e6, // 1.4 MHz
1.8e6, // 1.8 MHz
1.92e6, // 1.92 MHz
2.048e6, // 2.048 MHz
2.4e6, // 2.4 MHz
2.56e6, // 2.56 MHz
2.88e6, // 2.88 MHz
3.2e6, // 3.2 MHz (max)
],
lnaGainRange: { min: 0, max: 49.6, step: 0.1 },
maxBufferSize: 16384,
};
}

async open(): Promise<void> {
return this.device.open();
}

async close(): Promise<void> {
this.clearBuffers();
return this.device.close();
}

isOpen(): boolean {
return this.device.isOpen();
}

async setFrequency(frequencyHz: number): Promise<void> {
return this.device.setFrequency(frequencyHz);
}

async getFrequency(): Promise<number> {
return this.device.getFrequency();
}

async setSampleRate(sampleRateHz: number): Promise<void> {
return this.device.setSampleRate(sampleRateHz);
}

async getSampleRate(): Promise<number> {
return this.device.getSampleRate();
}

async getUsableBandwidth(): Promise<number> {
// RTL-SDR usable bandwidth is approximately 80% of sample rate
const sampleRate = await this.device.getSampleRate();
return sampleRate \* 0.8;
}

async setLNAGain(gainDb: number): Promise<void> {
return this.device.setGain(gainDb);
}

async setAmpEnable(enabled: boolean): Promise<void> {
// RTL-SDR doesn't have separate amp control
// Use gain instead: 0 dB when disabled, default gain when enabled
return this.device.setGain(enabled ? 20 : 0);
}

async receive(
callback: IQSampleCallback,
config?: Partial<SDRStreamConfig>
): Promise<void> {
return this.device.receive((samples) => {
// Track memory usage
const dataView = new DataView(new ArrayBuffer(samples.length \* 8));
this.activeBuffers.push(dataView);

      callback(samples);
    });

}

async stopRx(): Promise<void> {
return this.device.stopRx();
}

isReceiving(): boolean {
return this.device.isReceiving();
}

parseSamples(data: DataView): IQSample[] {
return this.device.parseSamples(data);
}

getMemoryInfo(): DeviceMemoryInfo {
const bufferBytes = this.activeBuffers.reduce(
(sum, buf) => sum + buf.byteLength,
0
);

    return {
      activeBuffers: this.activeBuffers.length,
      bufferBytes,
      peakBufferBytes: bufferBytes,  // Simplified tracking
    };

}

clearBuffers(): void {
this.activeBuffers = [];
}

async reset(): Promise<void> {
// RTL-SDR reset via USB control transfer
await this.device.close();
await this.device.open();
}
}
\`\`\`

### Step 3: Add USB Device Filter

Add your device's USB identifiers to \`src/models/SDRDevice.ts\`:

\`\`\`typescript
export const SDR_USB_DEVICES = {
HACKRF_ONE: {
vendorId: 0x1d50,
productId: 0x6089,
name: 'HackRF One',
},
RTLSDR_GENERIC: {
vendorId: 0x0bda,
productId: 0x2838,
name: 'RTL-SDR Generic',
},
// Add your new device here
YOUR_DEVICE: {
vendorId: 0xYOUR_VID,
productId: 0xYOUR_PID,
name: 'Your Device Name',
},
} as const;
\`\`\`

### Step 4: Create Device Hook

Create a React hook for device lifecycle management in \`src/hooks/useYourDevice.ts\`:

\`\`\`typescript
// src/hooks/useRTLSDRDevice.ts

import { useState, useCallback, useEffect } from 'react';
import { RTLSDRDeviceAdapter } from '../models/RTLSDRDeviceAdapter';
import { SDR_USB_DEVICES } from '../models/SDRDevice';
import { useUSBDevice } from './useUSBDevice';

export function useRTLSDRDevice() {
const [device, setDevice] = useState<RTLSDRDeviceAdapter | undefined>();
const [error, setError] = useState<Error | undefined>();

const { device: usbDevice, requestDevice } = useUSBDevice([
{
vendorId: SDR_USB_DEVICES.RTLSDR_GENERIC.vendorId,
productId: SDR_USB_DEVICES.RTLSDR_GENERIC.productId,
},
]);

const initialize = useCallback(async () => {
if (!usbDevice) {
await requestDevice();
return;
}

    try {
      const rtlsdr = new RTLSDRDeviceAdapter(usbDevice);
      await rtlsdr.open();
      setDevice(rtlsdr);
      setError(undefined);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      console.error('Failed to initialize RTL-SDR:', error);
    }

}, [usbDevice, requestDevice]);

const cleanup = useCallback(async () => {
if (device) {
try {
await device.close();
} catch (err) {
console.error('Error closing RTL-SDR:', err);
}
setDevice(undefined);
}
}, [device]);

useEffect(() => {
return () => {
cleanup();
};
}, [cleanup]);

return {
device,
error,
initialize,
cleanup,
};
}
\`\`\`

### Step 5: Write Tests

Create comprehensive tests in \`src/models/**tests**/YourDevice.test.ts\`:

\`\`\`typescript
// src/models/**tests**/RTLSDRDevice.test.ts

import { RTLSDRDeviceAdapter } from '../RTLSDRDeviceAdapter';
import { IQSample } from '../SDRDevice';

// Mock USB device
class MockUSBDevice implements Partial<USBDevice> {
opened = false;

async open(): Promise<void> {
this.opened = true;
}

async close(): Promise<void> {
this.opened = false;
}

async selectConfiguration(config: number): Promise<void> {}

async claimInterface(iface: number): Promise<void> {}

async releaseInterface(iface: number): Promise<void> {}

async controlTransferOut(setup: USBControlTransferParameters, data?: BufferSource): Promise<USBOutTransferResult> {
return { bytesWritten: data ? (data as ArrayBuffer).byteLength : 0, status: 'ok' };
}

async transferIn(endpoint: number, length: number): Promise<USBInTransferResult> {
// Return mock I/Q data
const buffer = new ArrayBuffer(length);
const view = new Uint8Array(buffer);
for (let i = 0; i < length; i++) {
view[i] = i % 256;
}
return { data: new DataView(buffer), status: 'ok' };
}
}

describe('RTLSDRDeviceAdapter', () => {
let device: RTLSDRDeviceAdapter;
let mockUSB: MockUSBDevice;

beforeEach(() => {
mockUSB = new MockUSBDevice();
device = new RTLSDRDeviceAdapter(mockUSB as USBDevice);
});

afterEach(async () => {
if (device.isOpen()) {
await device.close();
}
});

describe('Device Info', () => {
it('should return correct device info', async () => {
const info = await device.getDeviceInfo();
expect(info.type).toBe('RTL-SDR');
expect(info.name).toContain('RTL-SDR');
});

    it('should return correct capabilities', () => {
      const caps = device.getCapabilities();
      expect(caps.frequencyRange.min).toBe(24e6);
      expect(caps.frequencyRange.max).toBe(1766e6);
      expect(caps.sampleRates).toContain(2.048e6);
      expect(caps.lnaGainRange.min).toBe(0);
      expect(caps.lnaGainRange.max).toBeGreaterThan(40);
    });

});

describe('Lifecycle', () => {
it('should open device successfully', async () => {
await device.open();
expect(device.isOpen()).toBe(true);
expect(mockUSB.opened).toBe(true);
});

    it('should close device successfully', async () => {
      await device.open();
      await device.close();
      expect(device.isOpen()).toBe(false);
      expect(mockUSB.opened).toBe(false);
    });

});

describe('Configuration', () => {
beforeEach(async () => {
await device.open();
});

    it('should set frequency within valid range', async () => {
      await device.setFrequency(100e6);
      const freq = await device.getFrequency();
      expect(freq).toBe(100e6);
    });

    it('should reject frequency below minimum', async () => {
      await expect(device.setFrequency(10e6)).rejects.toThrow();
    });

    it('should reject frequency above maximum', async () => {
      await expect(device.setFrequency(2000e6)).rejects.toThrow();
    });

    it('should set sample rate within valid range', async () => {
      await device.setSampleRate(2.048e6);
      const rate = await device.getSampleRate();
      expect(rate).toBe(2.048e6);
    });

    it('should set LNA gain', async () => {
      await expect(device.setLNAGain(20)).resolves.not.toThrow();
    });

});

describe('Sample Parsing', () => {
it('should parse Uint8 samples correctly', () => {
const buffer = new ArrayBuffer(4);
const view = new DataView(buffer);
view.setUint8(0, 127); // I = 0
view.setUint8(1, 255); // Q = 1.0
view.setUint8(2, 0); // I = -1.0
view.setUint8(3, 127); // Q = 0

      const samples = device.parseSamples(view);

      expect(samples).toHaveLength(2);
      expect(samples[0].I).toBeCloseTo(0, 2);
      expect(samples[0].Q).toBeCloseTo(1.0, 2);
      expect(samples[1].I).toBeCloseTo(-1.0, 2);
      expect(samples[1].Q).toBeCloseTo(0, 2);
    });

    it('should handle empty buffer', () => {
      const buffer = new ArrayBuffer(0);
      const view = new DataView(buffer);
      const samples = device.parseSamples(view);
      expect(samples).toHaveLength(0);
    });

});

describe('Memory Management', () => {
it('should track memory usage', async () => {
await device.open();
const info = device.getMemoryInfo();
expect(info.activeBuffers).toBeGreaterThanOrEqual(0);
expect(info.bufferBytes).toBeGreaterThanOrEqual(0);
});

    it('should clear buffers', () => {
      device.clearBuffers();
      const info = device.getMemoryInfo();
      expect(info.activeBuffers).toBe(0);
      expect(info.bufferBytes).toBe(0);
    });

});
});
\`\`\`

### Step 6: Update UI

Add device selection to your UI (e.g., in \`src/pages/Visualizer.tsx\`):

\`\`\`typescript
import { useRTLSDRDevice } from '../hooks/useRTLSDRDevice';
import { useHackRFDevice } from '../hooks/useHackRFDevice';

function Visualizer() {
const [deviceType, setDeviceType] = useState<'HackRF' | 'RTL-SDR'>('HackRF');
const hackrf = useHackRFDevice();
const rtlsdr = useRTLSDRDevice();

const currentDevice = deviceType === 'HackRF' ? hackrf.device : rtlsdr.device;

return (

<div>
<select onChange={(e) => setDeviceType(e.target.value as any)}>
<option value="HackRF">HackRF One</option>
<option value="RTL-SDR">RTL-SDR</option>
</select>

      {/* Rest of UI */}
    </div>

);
}
\`\`\`

## Device Template

A starter template is available at \`src/models/templates/DeviceTemplate.ts\`. Copy this template and fill in device-specific implementation:

\`\`\`typescript
// src/models/templates/DeviceTemplate.ts

/\*\*

- Device Template
-
- Copy this file and replace all [DEVICE_NAME] placeholders with your device name.
- Implement all required methods according to your device's USB protocol.
  \*/

export class [DEVICE_NAME] {
private device: USBDevice;
private streaming = false;
private closing = false;

// Device state
private frequency = 100e6;
private sampleRate = 2e6;

// USB configuration - update these for your device
private readonly VENDOR_ID = 0x0000; // TODO: Update
private readonly PRODUCT_ID = 0x0000; // TODO: Update
private readonly CONFIG_NUM = 1;
private readonly INTERFACE_NUM = 0;
private readonly ENDPOINT_IN = 1;

// Control commands - update these for your device
private readonly CMD_SET_FREQ = 0x00; // TODO: Update
private readonly CMD_SET_SAMPLE_RATE = 0x00; // TODO: Update
private readonly CMD_SET_GAIN = 0x00; // TODO: Update

constructor(usbDevice: USBDevice) {
this.device = usbDevice;
}

async open(): Promise<void> {
// TODO: Implement device initialization
if (!this.device.opened) {
await this.device.open();
}
await this.device.selectConfiguration(this.CONFIG_NUM);
await this.device.claimInterface(this.INTERFACE_NUM);
}

async close(): Promise<void> {
// TODO: Implement device cleanup
if (this.closing) return;
this.closing = true;

    try {
      await this.stopRx();
      await this.device.releaseInterface(this.INTERFACE_NUM);
      await this.device.close();
    } finally {
      this.closing = false;
    }

}

isOpen(): boolean {
return this.device.opened;
}

async setFrequency(frequencyHz: number): Promise<void> {
// TODO: Implement frequency setting
// 1. Validate frequency range
// 2. Format frequency for device
// 3. Send control transfer
// 4. Update internal state

    throw new Error('Not implemented');

}

async getFrequency(): Promise<number> {
return this.frequency;
}

async setSampleRate(sampleRateHz: number): Promise<void> {
// TODO: Implement sample rate setting
throw new Error('Not implemented');
}

async getSampleRate(): Promise<number> {
return this.sampleRate;
}

async receive(callback: (samples: IQSample[]) => void): Promise<void> {
// TODO: Implement streaming
if (this.streaming) {
throw new Error('Already streaming');
}

    this.streaming = true;

    try {
      while (this.streaming && !this.closing) {
        const result = await this.device.transferIn(this.ENDPOINT_IN, 16384);
        if (result.data) {
          const samples = this.parseSamples(new DataView(result.data.buffer));
          callback(samples);
        }
      }
    } catch (err) {
      this.streaming = false;
      throw err;
    }

}

async stopRx(): Promise<void> {
this.streaming = false;
}

isReceiving(): boolean {
return this.streaming;
}

parseSamples(data: DataView): IQSample[] {
// TODO: Implement sample parsing for your device's format
// Common formats:
// - Int8 interleaved I/Q: convertInt8ToIQ(data)
// - Uint8 interleaved I/Q: convertUint8ToIQ(data)
// - Int16 interleaved I/Q: convertInt16ToIQ(data)

    throw new Error('Not implemented');

}
}
\`\`\`

## Testing Your Device

### Unit Tests

Run unit tests to verify basic functionality:

\`\`\`bash

# Run all tests

npm test

# Run only your device tests

npm test -- RTLSDRDevice

# Run with coverage

npm test -- --coverage
\`\`\`

### Manual Testing

1. **Connect Device**: Plug in your SDR device
2. **Start Dev Server**: \`npm start\`
3. **Open Browser**: Navigate to \`https://localhost:8080\`
4. **Select Device**: Choose your device from the dropdown
5. **Click Connect**: Browser will prompt for device selection
6. **Start Reception**: Click "Start Reception" button
7. **Verify Visualizations**: Check that IQ constellation, waveform, and spectrogram display correctly

### Integration Testing

Test your device with the full application:

\`\`\`bash

# Run end-to-end tests

npm run test:e2e

# Run in headed mode to see browser

npm run test:e2e:headed
\`\`\`

## Common Patterns

### Mutex Locking for Control Transfers

Prevent concurrent USB operations:

\`\`\`typescript
class MyDevice {
private transferMutex = Promise.resolve();

private async acquireLock(): Promise<() => void> {
let release: () => void;
const prev = this.transferMutex;
this.transferMutex = new Promise(r => (release = r));
await prev;
return release!;
}

async setFrequency(freq: number): Promise<void> {
const release = await this.acquireLock();
try {
await this.device.controlTransferOut(/_ ... _/);
} finally {
release();
}
}
}
\`\`\`

### Retry Logic for InvalidStateError

Handle transient USB errors:

\`\`\`typescript
async function withRetry<T>(
operation: () => Promise<T>,
maxRetries = 3,
delayMs = 100
): Promise<T> {
for (let i = 0; i < maxRetries; i++) {
try {
return await operation();
} catch (err) {
if (err instanceof DOMException && err.name === 'InvalidStateError' && i < maxRetries - 1) {
await new Promise(resolve => setTimeout(resolve, delayMs));
continue;
}
throw err;
}
}
throw new Error('Max retries exceeded');
}
\`\`\`

### Proper Streaming Loop

Handle errors and cleanup gracefully:

\`\`\`typescript
async receive(callback: IQSampleCallback): Promise<void> {
this.streaming = true;
let consecutiveErrors = 0;

try {
while (this.streaming && !this.closing) {
try {
const result = await this.device.transferIn(endpoint, bufferSize);

        if (result.data && result.data.byteLength > 0) {
          const samples = this.parseSamples(new DataView(result.data.buffer));
          callback(samples);
          consecutiveErrors = 0;
        }
      } catch (err) {
        consecutiveErrors++;
        if (consecutiveErrors > 10) {
          throw new Error('Too many consecutive errors');
        }
        console.warn('Transfer error, retrying:', err);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

} finally {
this.streaming = false;
}
}
\`\`\`

## Troubleshooting

### Device Not Found

**Problem**: Browser doesn't show device in selection dialog

**Solutions**:

- Verify USB vendor/product IDs are correct
- Check device is plugged in and powered on
- Try different USB port or cable
- On Linux, check udev rules for device permissions
- Restart browser

### InvalidStateError

**Problem**: USB operations fail with InvalidStateError

**Solutions**:

- Implement mutex locking for control transfers
- Add delays between operations
- Ensure device is properly initialized before operations
- Check that only one operation is in progress at a time

### No Data Received

**Problem**: Device connects but no samples received

**Solutions**:

- Verify endpoint number is correct
- Check sample rate is set before starting reception
- Verify buffer size matches device expectations
- Add logging to see if transfers complete
- Check parseSamples() is correctly interpreting data

### Incorrect Sample Values

**Problem**: Visualizations show unexpected patterns

**Solutions**:

- Verify sample format (Int8, Uint8, Int16)
- Check byte order (little-endian vs big-endian)
- Confirm normalization to ±1.0 range
- Test parseSamples() with known test data
- Compare with reference implementation (if available)

### Memory Leaks

**Problem**: Application becomes slow over time

**Solutions**:

- Implement clearBuffers() properly
- Track and release buffer references
- Use cleanup in React useEffect hooks
- Avoid creating new objects in hot paths

### USB Permission Errors

**Problem**: Access denied to USB device

**Solutions**:

- On Linux: Add udev rules for device
- On Windows: Install device drivers
- Ensure HTTPS context (WebUSB requirement)
- Grant permissions when browser prompts

## Additional Resources

- **WebUSB API**: [MDN Documentation](https://developer.mozilla.org/en-US/docs/Web/API/USB)
- **USB Protocol**: USB-IF specifications
- **Device Documentation**: Consult your device's datasheet and SDK
- **Reference Implementations**: Look for open-source drivers (libhackrf, librtlsdr, etc.)

## Getting Help

If you encounter issues:

1. Check existing device implementations (HackRFOne.ts, HackRFOneAdapter.ts)
2. Review test files for usage examples
3. Search for similar issues in the repository
4. Create a detailed issue with logs and device information
