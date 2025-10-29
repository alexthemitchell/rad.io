# How-To: Debug WebUSB Issues

This guide helps you troubleshoot common WebUSB problems when working with SDR devices in rad.io.

**Time to complete**: 30 minutes  
**Prerequisites**: Basic understanding of WebUSB  
**Difficulty**: Beginner to Intermediate

## Overview

WebUSB issues typically fall into these categories:
1. Device not detected
2. Permission errors
3. Transfer failures
4. Data corruption
5. Performance problems

## Quick Diagnostics

### Step 1: Check Browser Support

```typescript
// Test if WebUSB is available
if ('usb' in navigator) {
  console.log('✅ WebUSB supported');
} else {
  console.error('❌ WebUSB not supported - use Chrome, Edge, or Opera');
}
```

**Supported browsers:**
- ✅ Chrome 61+
- ✅ Edge 79+
- ✅ Opera 48+
- ❌ Firefox (no support)
- ❌ Safari (no support)

### Step 2: Check Connection

```typescript
// List already-granted devices
const devices = await navigator.usb.getDevices();
console.log(`Found ${devices.length} authorized devices`);

devices.forEach(device => {
  console.log(`Device: ${device.productName} (VID: 0x${device.vendorId.toString(16)})`);
});
```

### Step 3: Enable USB Logging in Chrome

1. Open Chrome
2. Navigate to `chrome://device-log`
3. Enable USB event logging
4. Reproduce the issue
5. Check logs for errors

## Common Problems and Solutions

### Problem 1: Device Not Appearing in Picker

**Symptoms:**
- Click "Connect Device" but device not listed
- Empty device picker dialog

**Causes and Solutions:**

#### Cause A: Wrong VID/PID Filter

```typescript
// ❌ Wrong - typo in VID
await navigator.usb.requestDevice({
  filters: [{ vendorId: 0x1d51, productId: 0x6089 }] // Should be 0x1d50
});

// ✅ Correct
await navigator.usb.requestDevice({
  filters: [{ vendorId: 0x1d50, productId: 0x6089 }] // HackRF One
});
```

**Fix:** Verify VID/PID with `lsusb` (Linux/Mac) or Device Manager (Windows).

#### Cause B: Device Not Connected

```bash
# Linux/Mac - check if device is connected
lsusb | grep -i hackrf

# Should show something like:
# Bus 001 Device 005: ID 1d50:6089 Great Scott Gadgets HackRF One
```

**Fix:** 
- Check USB cable
- Try different USB port
- Restart device

#### Cause C: Permission Issues (Linux)

Linux requires udev rules for non-root USB access:

```bash
# Create udev rule for HackRF
sudo tee /etc/udev/rules.d/52-hackrf.rules <<EOF
SUBSYSTEM=="usb", ATTR{idVendor}=="1d50", ATTR{idProduct}=="6089", MODE="0666"
EOF

# Reload udev rules
sudo udevadm control --reload-rules
sudo udevadm trigger

# Replug device
```

**Common device rules:**

```bash
# HackRF One
SUBSYSTEM=="usb", ATTR{idVendor}=="1d50", ATTR{idProduct}=="6089", MODE="0666"

# RTL-SDR
SUBSYSTEM=="usb", ATTR{idVendor}=="0bda", ATTR{idProduct}=="2838", MODE="0666"

# Airspy
SUBSYSTEM=="usb", ATTR{idVendor}=="1d50", ATTR{idProduct}=="60a1", MODE="0666"
```

### Problem 2: "Device not found" Error

**Symptoms:**
```
NotFoundError: No device selected
```

**Cause:** User cancelled device picker or no matching devices.

**Solution:**

```typescript
async function connectDeviceWithRetry() {
  try {
    const device = await navigator.usb.requestDevice({
      filters: [{ vendorId: 0x1d50 }]
    });
    return device;
  } catch (error) {
    if (error.name === 'NotFoundError') {
      alert(
        'No device selected. Please:\n' +
        '1. Connect your SDR device\n' +
        '2. Try again and select it from the list'
      );
    }
    throw error;
  }
}
```

### Problem 3: "Failed to open device" Error

**Symptoms:**
```
NetworkError: Failed to open the device
```

**Causes and Solutions:**

#### Cause A: Device In Use by Another Application

**Check:**
```bash
# Linux - list processes using USB device
lsof | grep usb

# Kill competing process
kill <PID>
```

**Fix:** Close other applications using the device:
- Other browser tabs
- Native SDR applications (GQRX, SDR#, etc.)
- Background services

#### Cause B: Device Already Open in Same Tab

```typescript
class SafeDevice {
  private device: USBDevice;
  private isOpen = false;
  
  async open() {
    if (this.isOpen) {
      console.warn('Device already open');
      return;
    }
    
    await this.device.open();
    this.isOpen = true;
  }
  
  async close() {
    if (!this.isOpen) return;
    
    await this.device.close();
    this.isOpen = false;
  }
}
```

### Problem 4: Transfer Failures

**Symptoms:**
```
NetworkError: A transfer error has occurred
```

**Causes and Solutions:**

#### Cause A: Device Unplugged During Transfer

```typescript
async function robustTransfer(device: USBDevice, endpoint: number, size: number) {
  try {
    return await device.transferIn(endpoint, size);
  } catch (error) {
    if (error.name === 'NetworkError') {
      console.error('Device disconnected or transfer failed');
      await handleDisconnection(device);
    }
    throw error;
  }
}
```

#### Cause B: Wrong Endpoint Number

```typescript
// Debug: Log all available endpoints
async function listEndpoints(device: USBDevice) {
  for (const config of device.configurations) {
    console.log(`Configuration ${config.configurationValue}:`);
    for (const iface of config.interfaces) {
      for (const alt of iface.alternates) {
        console.log(`  Interface ${iface.interfaceNumber}, Alt ${alt.alternateSetting}:`);
        for (const endpoint of alt.endpoints) {
          console.log(`    Endpoint ${endpoint.endpointNumber} (${endpoint.direction})`);
        }
      }
    }
  }
}
```

#### Cause C: Buffer Size Too Large

```typescript
// ❌ May fail - buffer too large
await device.transferIn(1, 10 * 1024 * 1024); // 10 MB

// ✅ Good - reasonable buffer size
await device.transferIn(1, 256 * 1024); // 256 KB
```

**Recommended buffer sizes:**
- Bulk transfers: 64 KB - 256 KB
- Control transfers: < 4 KB

### Problem 5: Data Corruption

**Symptoms:**
- Garbled visualizations
- Unexpected values in I/Q samples
- Crashes when parsing data

**Debugging:**

```typescript
function validateSamples(data: DataView): boolean {
  // Check for reasonable values
  for (let i = 0; i < data.byteLength; i += 2) {
    const i_val = data.getInt8(i);
    const q_val = data.getInt8(i + 1);
    
    // I/Q samples should be in range [-128, 127]
    if (i_val < -128 || i_val > 127 || q_val < -128 || q_val > 127) {
      console.error(`Invalid sample at offset ${i}: I=${i_val}, Q=${q_val}`);
      return false;
    }
  }
  return true;
}

// Use in transfer handler
const result = await device.transferIn(1, bufferSize);
if (result.status === 'ok' && result.data) {
  if (!validateSamples(result.data)) {
    console.error('Data corruption detected!');
    // Log first few bytes for debugging
    const bytes = new Uint8Array(result.data.buffer, 0, 16);
    console.error('First 16 bytes:', Array.from(bytes).map(b => b.toString(16)));
  }
}
```

**Common data format issues:**

```typescript
// Different devices use different formats

// HackRF: Signed 8-bit I/Q
function parseHackRF(data: DataView): IQSample[] {
  const samples: IQSample[] = [];
  for (let i = 0; i < data.byteLength; i += 2) {
    samples.push({
      i: data.getInt8(i) / 127.0,
      q: data.getInt8(i + 1) / 127.0
    });
  }
  return samples;
}

// RTL-SDR: Unsigned 8-bit I/Q (DC offset at 127.5)
function parseRTLSDR(data: DataView): IQSample[] {
  const samples: IQSample[] = [];
  for (let i = 0; i < data.byteLength; i += 2) {
    samples.push({
      i: (data.getUint8(i) - 127.5) / 127.5,
      q: (data.getUint8(i + 1) - 127.5) / 127.5
    });
  }
  return samples;
}
```

### Problem 6: Permission Denied

**Symptoms:**
```
SecurityError: Access to the device was denied
```

**Causes and Solutions:**

#### Cause A: Not HTTPS

WebUSB requires HTTPS (except localhost):

```typescript
if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
  alert('WebUSB requires HTTPS. Please use https://');
}
```

#### Cause B: Not User-Initiated

Must be called from user gesture:

```typescript
// ❌ Won't work - not from user gesture
window.addEventListener('load', async () => {
  await navigator.usb.requestDevice({ filters: [] }); // Throws!
});

// ✅ Works - from button click
button.addEventListener('click', async () => {
  await navigator.usb.requestDevice({ filters: [] }); // OK
});
```

## Advanced Debugging

### Enable Verbose Logging

```typescript
class VerboseDevice {
  constructor(private device: USBDevice) {
    this.wrapMethods();
  }
  
  private wrapMethods() {
    const originalOpen = this.device.open.bind(this.device);
    this.device.open = async () => {
      console.log('[USB] Opening device...');
      const result = await originalOpen();
      console.log('[USB] Device opened');
      return result;
    };
    
    const originalTransferIn = this.device.transferIn.bind(this.device);
    this.device.transferIn = async (endpoint, length) => {
      console.log(`[USB] transferIn(${endpoint}, ${length})`);
      const start = performance.now();
      const result = await originalTransferIn(endpoint, length);
      const duration = performance.now() - start;
      console.log(`[USB] transferIn completed in ${duration.toFixed(2)}ms, status: ${result.status}`);
      return result;
    };
    
    // Wrap other methods similarly...
  }
}
```

### Monitor Transfer Performance

```typescript
class TransferStats {
  private transfers: number[] = [];
  
  recordTransfer(bytesReceived: number, durationMs: number) {
    const mbps = (bytesReceived * 8 / 1000000) / (durationMs / 1000);
    this.transfers.push(mbps);
    
    // Keep last 100 transfers
    if (this.transfers.length > 100) {
      this.transfers.shift();
    }
  }
  
  getStats() {
    const avg = this.transfers.reduce((a, b) => a + b) / this.transfers.length;
    const min = Math.min(...this.transfers);
    const max = Math.max(...this.transfers);
    
    return { avg, min, max };
  }
  
  report() {
    const { avg, min, max } = this.getStats();
    console.log(`Transfer speed: avg=${avg.toFixed(2)} Mbps, min=${min.toFixed(2)}, max=${max.toFixed(2)}`);
  }
}
```

### Capture Raw USB Data

```typescript
async function captureRawData(device: USBDevice, endpoint: number, count: number) {
  const captures: Uint8Array[] = [];
  
  for (let i = 0; i < count; i++) {
    const result = await device.transferIn(endpoint, 256 * 1024);
    if (result.status === 'ok' && result.data) {
      captures.push(new Uint8Array(result.data.buffer.slice(0)));
    }
  }
  
  // Save to file for analysis
  const blob = new Blob(captures);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'usb-capture.bin';
  a.click();
}
```

## Testing Strategies

### Mock Device for Testing

```typescript
class MockUSBDevice implements USBDevice {
  // Implement USBDevice interface with test data
  
  async transferIn(endpoint: number, length: number): Promise<USBInTransferResult> {
    // Return test data
    const buffer = new ArrayBuffer(length);
    const view = new Uint8Array(buffer);
    
    // Fill with test pattern
    for (let i = 0; i < length; i++) {
      view[i] = i % 256;
    }
    
    return {
      data: new DataView(buffer),
      status: 'ok'
    };
  }
  
  // Implement other methods...
}
```

### Automated Error Recovery

```typescript
class ResilientDevice {
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  
  async withAutoReconnect<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error.name === 'NetworkError' && this.reconnectAttempts < this.maxReconnectAttempts) {
        console.warn(`Transfer failed, reconnecting (attempt ${this.reconnectAttempts + 1})...`);
        this.reconnectAttempts++;
        
        await this.close();
        await this.delay(1000);
        await this.open();
        
        return this.withAutoReconnect(operation);
      }
      throw error;
    }
  }
  
  private delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

## Diagnostic Checklist

When debugging WebUSB issues, check:

- [ ] Browser supports WebUSB
- [ ] Using HTTPS (or localhost)
- [ ] Device physically connected
- [ ] Correct USB cable (data, not charge-only)
- [ ] Device powered on
- [ ] No other apps using device
- [ ] Correct VID/PID in filter
- [ ] Permission granted by user
- [ ] Device not suspended/sleeping
- [ ] USB hub working (try direct connection)
- [ ] Sufficient USB bus power

## Getting Help

### Gather Debug Information

```typescript
async function gatherDebugInfo() {
  const info = {
    browser: navigator.userAgent,
    webUSBSupported: 'usb' in navigator,
    platform: navigator.platform,
    devices: await navigator.usb.getDevices(),
    permissions: await navigator.permissions.query({ name: 'usb' as any })
  };
  
  console.log('Debug Info:', JSON.stringify(info, null, 2));
  return info;
}
```

### Report Issues

When reporting WebUSB issues, include:
1. Browser version
2. Operating system
3. Device model (VID/PID)
4. Error message and stack trace
5. Console logs
6. Steps to reproduce

## Learn More

- [WebUSB and Browser Integration](../explanation/webusb-browser-integration.md)
- [Hardware Integration](../reference/hardware-integration.md)
- [WebUSB Specification](https://wicg.github.io/webusb/)
- [MDN WebUSB Guide](https://developer.mozilla.org/en-US/docs/Web/API/USB)

## Need Help?

- [GitHub Discussions](https://github.com/alexthemitchell/rad.io/discussions)
- [WebUSB Issues](https://github.com/alexthemitchell/rad.io/labels/webusb)
- [Hardware Support](https://github.com/alexthemitchell/rad.io/labels/hardware)
