# WebUSB and Browser Integration

This document explains how rad.io uses the WebUSB API to communicate with SDR hardware directly from the browser, and why this approach enables a unique SDR experience.

## What is WebUSB?

WebUSB is a web standard that allows web applications to communicate with USB devices, with user permission. It brings USB device access to the web platform while maintaining security through explicit user consent.

**Key Features:**
- Direct hardware communication from JavaScript
- User-controlled permissions (browser prompts for device access)
- Secure by design (requires HTTPS)
- Cross-platform (works identically on Windows, macOS, Linux)

## Why WebUSB for SDR?

### Traditional SDR Architecture

```
Radio Waves → SDR Hardware → USB → Native Driver → Desktop App
                                     (kernel mode)   (user space)
```

**Challenges:**
- Requires installing native drivers
- OS-specific driver builds
- Root/admin access often needed
- Driver conflicts possible
- Distribution and updates complex

### rad.io Architecture

```
Radio Waves → SDR Hardware → USB → Browser (WebUSB) → Web App
                                    (user space)       (JavaScript)
```

**Benefits:**
- ✅ No driver installation required
- ✅ Works across all platforms with one codebase
- ✅ Browser sandbox provides security
- ✅ Automatic updates via web deployment
- ✅ User controls device permissions
- ⚠️ Requires WebUSB-supporting browser (Chrome, Edge, Opera)

## How WebUSB Works

### 1. Device Discovery

User clicks "Connect Device" button, triggering the browser's device picker:

```typescript
// Request device from user
const device = await navigator.usb.requestDevice({
  filters: [
    { vendorId: 0x1d50, productId: 0x6089 } // HackRF One
  ]
});
```

**What happens:**
1. Browser shows list of connected USB devices matching filter
2. User selects desired device
3. Browser grants permission for this specific device
4. Web app receives `USBDevice` object

### 2. Device Connection

```typescript
// Open device and claim interface
await device.open();
await device.selectConfiguration(1);
await device.claimInterface(0);
```

**What happens:**
1. `open()` - Establishes connection to device
2. `selectConfiguration()` - Chooses USB configuration (usually 1)
3. `claimInterface()` - Claims exclusive access to interface

**Interface claiming** means the web app has exclusive control - other apps (including native apps) can't access the device simultaneously.

### 3. Control Transfers

Used for sending commands (set frequency, gain, etc.):

```typescript
// Set frequency to 100 MHz
await device.controlTransferOut({
  requestType: 'vendor',    // Device-specific command
  recipient: 'device',      // Target the device
  request: 0x01,            // SET_FREQ command code
  value: 0,                 // High word
  index: 0,                 // Low word
}, frequencyBuffer);        // Payload data
```

**Control transfers** are for configuration and commands:
- Reliable (USB guarantees delivery)
- Small payloads (typically < 4KB)
- Blocking (waits for completion)
- Used for: frequency, gain, sample rate, device settings

### 4. Bulk Transfers

Used for high-speed data streaming:

```typescript
// Receive I/Q samples
const result = await device.transferIn(
  1,          // Endpoint number (bulk IN)
  262144      // Buffer size (256 KB)
);

if (result.status === 'ok') {
  const samples = parseIQData(result.data);
  processSamples(samples);
}
```

**Bulk transfers** are for data streaming:
- High throughput (up to USB 2.0 speed: 480 Mbps)
- Large payloads (256 KB typical)
- Best-effort delivery
- Used for: I/Q sample streams

## Data Flow in Detail

### USB → Browser → JavaScript

```
┌─────────────┐
│ SDR Device  │  Samples I/Q at 20 MS/s
└──────┬──────┘
       │ USB 2.0 Bulk Transfer
       │ 40 MB/s (I/Q: 2 bytes each)
       ↓
┌──────────────┐
│   Browser    │  WebUSB API
│   (Chrome)   │  transferIn() returns DataView
└──────┬───────┘
       │ JavaScript API
       │ ArrayBuffer / DataView
       ↓
┌──────────────┐
│  Device      │  parseIQData()
│  Driver      │  Convert to IQSample[]
│  (JS)        │
└──────┬───────┘
       │ TypeScript objects
       │ IQSample[] array
       ↓
┌──────────────┐
│  DSP         │  FFT, demodulation
│  Pipeline    │  Web Worker + WASM
└──────┬───────┘
       │ Processed data
       │ Float32Array
       ↓
┌──────────────┐
│  Render      │  WebGL / Canvas
└──────────────┘
```

## Security Model

### Permission System

WebUSB requires explicit user permission for each device:

1. **Request Phase**: User must click to trigger device picker
2. **Grant Phase**: User selects specific device from list
3. **Persistence**: Permission saved for origin (can be revoked)

```typescript
// ❌ CANNOT do this without user interaction
window.addEventListener('load', async () => {
  // This will throw - must be triggered by user gesture
  await navigator.usb.requestDevice({ filters: [] });
});

// ✅ Must be in response to user action
button.addEventListener('click', async () => {
  // This works - user clicked the button
  await navigator.usb.requestDevice({ filters: [] });
});
```

### HTTPS Requirement

WebUSB only works in secure contexts:

- ✅ `https://` sites
- ✅ `localhost` (for development)
- ❌ `http://` (non-localhost)
- ❌ `file://` URLs

**Why?** Prevent malicious sites from accessing USB devices.

### Same-Origin Policy

Each origin gets separate permissions:
- `https://rad.io` has its own permissions
- `https://evil.com` cannot access devices permitted to `https://rad.io`
- Permissions are tied to (protocol, domain, port) tuple

## Device Compatibility

### Supported Devices in rad.io

| Device | VID | PID | Status |
|--------|-----|-----|--------|
| HackRF One | 0x1d50 | 0x6089 | ✅ Full support |
| RTL-SDR | 0x0bda | 0x2838 | ✅ Full support |
| Airspy | 0x1d50 | 0x60a1 | 🚧 In progress |

### USB Requirements

Devices must:
- Support USB 2.0 or higher
- Use standard USB transfer types (control, bulk)
- Not require proprietary drivers
- Provide accessible endpoints

### Why Some Devices Don't Work

**Browser Limitations:**
- No isochronous transfer support (yet)
- No USB 3.0-specific features
- Some browsers don't implement WebUSB (Firefox, Safari)

**Device Limitations:**
- Requires proprietary kernel driver
- Uses HID class (different API - WebHID)
- Needs raw USB access below libusb level

## Performance Characteristics

### Throughput

Theoretical maximum (USB 2.0):
- **480 Mbps** = 60 MB/s
- **Overhead**: ~20% → effective 48 MB/s

Typical SDR streaming:
- **20 MS/s I/Q** = 40 MB/s (16-bit samples)
- Well within USB 2.0 capacity
- WebUSB adds <5% overhead

### Latency

From USB packet to JavaScript:
- **USB latency**: 1-2 ms (USB 2.0 microframe)
- **Browser processing**: 1-5 ms
- **JavaScript callback**: <1 ms
- **Total**: 3-8 ms typical

This is comparable to native drivers.

### CPU Usage

WebUSB itself is efficient:
- Minimal overhead vs native USB
- Browser handles USB stack in C++
- Only data copying adds overhead

Bottlenecks are typically:
- Data parsing (JS → WASM helps)
- DSP processing (Web Workers help)
- Rendering (GPU helps)

## Error Handling

### Common Errors

**Device Disconnected:**
```typescript
try {
  await device.transferIn(1, 262144);
} catch (error) {
  if (error.name === 'NetworkError') {
    // Device was unplugged
    await handleDisconnection();
  }
}
```

**Permission Denied:**
```typescript
try {
  await navigator.usb.requestDevice({ filters });
} catch (error) {
  if (error.name === 'NotFoundError') {
    // User cancelled or no devices matched
  }
}
```

**Device Busy:**
```typescript
try {
  await device.claimInterface(0);
} catch (error) {
  if (error.name === 'InvalidStateError') {
    // Interface already claimed (by another app)
    alert('Close other apps using this device');
  }
}
```

### Robust Error Recovery

```typescript
class RobustDevice {
  async transferWithRetry(endpoint: number, size: number, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        return await this.device.transferIn(endpoint, size);
      } catch (error) {
        if (i === retries - 1) throw error;
        await this.delay(100 * (i + 1)); // Exponential backoff
      }
    }
  }
}
```

## Browser Compatibility

### Supported Browsers

| Browser | Version | WebUSB Support |
|---------|---------|----------------|
| Chrome | 61+ | ✅ Full |
| Edge | 79+ | ✅ Full |
| Opera | 48+ | ✅ Full |
| Firefox | All | ❌ No support |
| Safari | All | ❌ No support |

### Feature Detection

```typescript
function isWebUSBSupported(): boolean {
  return 'usb' in navigator;
}

if (!isWebUSBSupported()) {
  alert('Your browser does not support WebUSB. Please use Chrome or Edge.');
}
```

## Comparison with Native Drivers

### Advantages of WebUSB

| Feature | Native Driver | WebUSB |
|---------|--------------|---------|
| Installation | Required (admin) | None |
| Updates | Manual | Automatic |
| Cross-platform | Separate builds | Universal |
| Permissions | OS-level | User-controlled |
| Security | Kernel mode risk | Sandboxed |
| Development | C/C++ toolchain | JavaScript/WASM |

### When to Use Native Drivers

Native drivers may be better for:
- ❌ Maximum performance (though WebUSB is close)
- ❌ Browser-unsupported devices
- ❌ Integration with other native apps
- ❌ Platforms without WebUSB browsers

## Debugging WebUSB Issues

### Chrome DevTools

View USB devices and transfers:
1. Open DevTools (F12)
2. Go to "Network" tab
3. Enable "USB" filter
4. See all USB operations

### Common Issues

**Device not appearing in picker:**
- Check USB cable connection
- Verify VID/PID in filter
- Try different USB port
- Check OS permissions (Linux: udev rules)

**Transfer failures:**
- Check endpoint numbers match device
- Verify buffer sizes are appropriate
- Ensure device firmware is responsive
- Check USB cable quality

**Permission errors:**
- Close other apps using device
- Revoke and re-grant permission
- Restart browser
- Try different browser profile

## Future Developments

### Upcoming Web Standards

**WebUSB 2.0 Features:**
- Isochronous transfers (audio/video devices)
- USB 3.0 support
- Better error reporting

**Related APIs:**
- **WebHID**: Human Interface Devices
- **WebSerial**: Serial ports (RS-232, UART)
- **WebBluetooth**: Bluetooth LE devices

### rad.io Roadmap

- Support for more SDR devices
- Improved error handling and recovery
- Better diagnostics and debugging tools
- Device firmware update support

## Learn More

- **[WebUSB Specification](https://wicg.github.io/webusb/)** - Official spec
- **[MDN WebUSB Guide](https://developer.mozilla.org/en-US/docs/Web/API/USB)** - API reference
- **[How-To: Add New SDR Device](../how-to/add-new-sdr-device.md)** - Implementation guide
- **[How-To: Debug WebUSB Issues](../how-to/debug-webusb.md)** - Troubleshooting

## Questions?

- [GitHub Discussions](https://github.com/alexthemitchell/rad.io/discussions)
- [WebUSB Community Group](https://discourse.wicg.io/c/webusb)
