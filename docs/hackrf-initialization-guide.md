# HackRF Device Initialization Best Practices

This guide documents the correct initialization sequence and best practices for using the HackRF One WebUSB driver in the rad.io application.

## Quick Reference

### Minimal Working Example

```typescript
import { HackRFOne } from "./hackrf/HackRFOne";

// 1. Create instance from USB device
const hackrf = new HackRFOne(usbDevice);

// 2. Open device (initializes USB connection)
await hackrf.open();

// 3. Configure sample rate (CRITICAL - must be first!)
await hackrf.setSampleRate(20_000_000); // 20 MSPS

// 4. Configure frequency
await hackrf.setFrequency(100_000_000); // 100 MHz

// 5. Optional: Configure bandwidth, gain, amplifier
await hackrf.setBandwidth(20_000_000); // 20 MHz
await hackrf.setLNAGain(16); // 16 dB
await hackrf.setAmpEnable(false);

// 6. Start receiving
await hackrf.receive((dataView) => {
  const samples = convertInt8ToIQ(dataView);
  processSamples(samples);
});

// 7. Stop when done
await hackrf.stopRx();
await hackrf.close();
```

## Critical Initialization Sequence

### Why Order Matters

The HackRF device requires configuration in a specific order for reliable operation:

1. **Sample Rate MUST be set before streaming**
   - Without sample rate, `transferIn()` hangs indefinitely
   - No error is thrown - just infinite waiting
   - This is the #1 cause of "device not responding" issues

2. **Frequency should be set before streaming**
   - Determines center frequency for reception
   - Can be changed during streaming but best set first

3. **Other settings are optional but recommended**
   - Bandwidth: Affects baseband filter
   - LNA Gain: Controls signal amplification (0-40 dB)
   - Amplifier: Additional amplification stage

### Step-by-Step Initialization

#### Step 1: Open USB Connection

```typescript
const hackrf = new HackRFOne(usbDevice);
await hackrf.open();
```

**What happens:**

- Opens USB device if not already open
- Selects configuration (typically config 1)
- Finds interface with bulk IN endpoint
- Claims interface for exclusive access
- Saves endpoint number for data streaming

**Troubleshooting:**

- "No interface found": Device not properly connected
- "Interface already claimed": Another application is using the device

#### Step 2: Set Sample Rate (CRITICAL!)

```typescript
await hackrf.setSampleRate(20_000_000); // 20 MSPS
```

**What happens:**

- Validates sample rate is in range (2-20 MSPS for HackRF)
- Calculates optimal frequency and divider parameters
- Sends `SAMPLE_RATE_SET` command via control transfer
- Stores value for health checks and recovery

**Valid Sample Rates:**

- Minimum: 2 MSPS (2,000,000 Hz)
- Maximum: 20 MSPS (20,000,000 Hz)
- Common: 8, 10, 16, 20 MSPS

**Why This Is Critical:**
The HackRF firmware requires a sample rate to be configured before it will stream data. Without it, the device enters a waiting state and `transferIn()` calls will hang indefinitely with no error message.

#### Step 3: Set Center Frequency

```typescript
await hackrf.setFrequency(100_000_000); // 100 MHz
```

**What happens:**

- Validates frequency is in range (1 MHz - 6 GHz)
- Splits frequency into MHz and Hz components
- Sends `SET_FREQ` command with both components
- Device tunes to requested frequency

**Valid Frequencies:**

- Minimum: 1 MHz (1,000,000 Hz)
- Maximum: 6 GHz (6,000,000,000 Hz)
- Example ranges:
  - FM Radio: 88-108 MHz
  - Amateur 2m: 144-148 MHz
  - GPS L1: 1575.42 MHz

#### Step 4: Set Bandwidth (Optional)

```typescript
await hackrf.setBandwidth(20_000_000); // 20 MHz
```

**What happens:**

- Validates bandwidth is in range (1.75-28 MHz)
- Selects nearest available bandwidth from hardware table
- Sends `BASEBAND_FILTER_BANDWIDTH_SET` command

**Available Bandwidths (MHz):**
1.75, 2.5, 3.5, 5.0, 5.5, 6.0, 7.0, 8.0, 9.0, 10.0, 12.0, 14.0, 15.0, 20.0, 24.0, 28.0

**Recommendation:**
Set bandwidth equal to or slightly larger than sample rate for best performance.

#### Step 5: Set LNA Gain (Optional)

```typescript
await hackrf.setLNAGain(16); // 16 dB
```

**What happens:**

- Validates gain is in range (0-40 dB in 8 dB steps)
- Sends `SET_LNA_GAIN` command
- Adjusts low-noise amplifier gain

**Valid Gain Values:**
0, 8, 16, 24, 32, 40 dB

**Recommendations:**

- Start with 16 dB for general use
- Increase for weak signals
- Decrease if experiencing overload/distortion

#### Step 6: Enable Amplifier (Optional)

```typescript
await hackrf.setAmpEnable(false); // Usually off for receive
```

**What happens:**

- Enables or disables additional amplification stage
- Sends `AMP_ENABLE` command with boolean value

**Recommendations:**

- Typically disabled (false) for receive mode
- Enable only for very weak signals
- Can cause overload if used with strong signals

#### Step 7: Start Receiving

```typescript
const receivePromise = hackrf.receive((dataView) => {
  // Process each chunk of data
  const samples = convertInt8ToIQ(dataView);
  processSamples(samples);
});
```

**What happens:**

- Validates device health (open, sample rate set, not closing)
- Sets transceiver mode to RECEIVE
- Enters continuous streaming loop
- Reads 4KB chunks via `transferIn()` on bulk endpoint
- Calls callback for each chunk received
- Protected by 5-second timeout per transfer
- Tracks consecutive timeouts (fails after 3)

**Data Format:**

- Type: Int8 array (signed 8-bit integers)
- Layout: Interleaved I/Q pairs [I0, Q0, I1, Q1, ...]
- Normalization: Divide by 128 to get ±1.0 range
- Each 4KB transfer ≈ 2048 IQ samples

#### Step 8: Stop and Cleanup

```typescript
// Signal stop (sets streaming flag to false)
await hackrf.stopRx();

// Wait for streaming loop to exit
await receivePromise;

// Close device connection
await hackrf.close();
```

**What happens (stopRx):**

- Clears streaming flag
- Sends transceiver OFF command
- Allows receive loop to exit cleanly

**What happens (close):**

- Sets closing flag
- Stops any ongoing streaming
- Releases USB interface
- Closes USB device

## Common Pitfalls and Solutions

### Problem: Device Shows "Receiving" But No Data

**Symptom:**

- UI indicates streaming is active
- No visualizations update
- No errors displayed

**Cause:**
Sample rate was not configured before calling `receive()`

**Solution:**

```typescript
// WRONG - sample rate missing
await hackrf.open();
await hackrf.setFrequency(100_000_000);
await hackrf.receive(callback); // Will hang!

// CORRECT - sample rate set first
await hackrf.open();
await hackrf.setSampleRate(20_000_000); // CRITICAL
await hackrf.setFrequency(100_000_000);
await hackrf.receive(callback); // Works!
```

### Problem: Transfer Timeouts

**Symptom:**

- Console shows "transferIn timeout" messages
- Streaming stops after 3 consecutive timeouts

**Possible Causes:**

1. Sample rate not configured
2. Device needs physical reset
3. USB power issues
4. Firmware incompatibility

**Solutions:**

1. Verify sample rate is set before streaming
2. Unplug and replug USB cable
3. Press physical reset button on device
4. Try different USB port (avoid hubs)
5. Update device firmware

### Problem: Windows/WebUSB Transfer Errors (NetworkError)

**Symptom:**

- "Failed to execute 'controlTransferOut' on 'USBDevice': A transfer error has occurred."
- Errors occur immediately when setting sample rate or other vendor commands

**Cause:**

- On Windows, WebUSB requires the WinUSB driver. If the HackRF interface is bound to another driver (libusbK, WinUSB not installed, or used by another app), vendor control transfers may fail.

**Fix (Windows, using Zadig):**

1. Disconnect other SDR applications (SDR#, CubicSDR, HackRF_transfer)
2. Install Zadig from https://zadig.akeo.ie/
3. Plug in the HackRF, then open Zadig and select:

- Options → List All Devices
- Choose "HackRF One" (or "Great Scott Gadgets HackRF One")
- Driver: WinUSB (v6.x)
- Click "Install Driver" (or "Replace Driver")

4. Unplug/replug the HackRF
5. Retry in the browser (https://localhost:8080/monitor)

If issues persist, reflash or update HackRF firmware: https://greatscottgadgets.com/hackrf/one/

### Problem: Invalid Configuration Values

**Symptom:**

- Throws `HackrfError` with `INVALID_PARAM` code

**Solution:**
Check that all values are within valid ranges:

```typescript
// Validate before sending
function validateConfig(config) {
  if (config.sampleRate < 2_000_000 || config.sampleRate > 20_000_000) {
    throw new Error(`Invalid sample rate: ${config.sampleRate}`);
  }
  if (config.frequency < 1_000_000 || config.frequency > 6_000_000_000) {
    throw new Error(`Invalid frequency: ${config.frequency}`);
  }
  if (config.lnaGain < 0 || config.lnaGain > 40 || config.lnaGain % 8 !== 0) {
    throw new Error(`Invalid LNA gain: ${config.lnaGain}`);
  }
}
```

### Problem: Device Health Check Failures

**Symptom:**

- `validateReadyForStreaming()` returns issues

**Check:**

```typescript
const health = hackrf.validateReadyForStreaming();
if (!health.ready) {
  console.error("Device not ready:", health.issues);
  // Address issues before streaming
}
```

**Common Issues:**

- "Device is not open" → Call `open()` first
- "Sample rate not configured" → Call `setSampleRate()` first
- "Device is closing" → Don't stream during shutdown
- "Device is already streaming" → Stop existing stream first

## Advanced Topics

### Changing Configuration During Streaming

Most settings can be changed while streaming:

```typescript
// Start streaming
await hackrf.receive(callback);

// Change frequency (allowed)
await hackrf.setFrequency(200_000_000);

// Change gain (allowed)
await hackrf.setLNAGain(24);

// Change sample rate (allowed but may cause brief interruption)
await hackrf.setSampleRate(10_000_000);
```

### Error Recovery

The driver includes automatic recovery for timeouts:

```typescript
// After 3 consecutive timeouts, automatic recovery is attempted
// Recovery process:
// 1. Send USB reset command
// 2. Wait 150ms for stabilization
// 3. Restore all configuration (sample rate, frequency, etc.)
// 4. Set transceiver mode to RECEIVE
```

Manual recovery:

```typescript
// Fast recovery (restores config automatically)
await hackrf.fastRecovery();

// Full reset (requires reconfiguration)
await hackrf.reset();
// Must reconfigure after reset:
await hackrf.setSampleRate(20_000_000);
await hackrf.setFrequency(100_000_000);
// ...
```

### Memory Management

The driver tracks buffer usage to prevent memory leaks:

```typescript
// Get memory info
const memInfo = hackrf.getMemoryInfo();
console.log(`Tracked buffers: ${memInfo.bufferCount}`);
console.log(`Total size: ${memInfo.totalSize} bytes`);

// Automatic cleanup
// - Buffers older than 5 seconds are automatically removed
// - Cleanup runs every 1000 iterations
// - All buffers cleared on stopRx()
```

### Configuration Status

Check device configuration at any time:

```typescript
const status = hackrf.getConfigurationStatus();
console.log("Device open:", status.isOpen);
console.log("Streaming:", status.isStreaming);
console.log("Sample rate:", status.sampleRate);
console.log("Frequency:", status.frequency);
console.log("Configured:", status.isConfigured); // true if sample rate set
```

## Integration with React Hook

The `useHackRFDevice` hook handles initialization automatically:

```typescript
import { useHackRFDevice } from "./hackrf";

function MyComponent() {
  const { device, initialize, isCheckingPaired } = useHackRFDevice();

  // Auto-connects to previously paired device
  // Or call initialize() to show device picker

  useEffect(() => {
    if (!device) return;

    // Device is already open, just configure and stream
    const startStreaming = async () => {
      await device.setSampleRate(20_000_000); // CRITICAL!
      await device.setFrequency(100_000_000);
      await device.receive(handleData);
    };

    startStreaming();

    return () => {
      device.stopRx();
    };
  }, [device]);
}
```

## Testing Without Hardware

For development without physical hardware:

```typescript
// Use mock USB device
const mockDevice = {
  vendorId: 0x1d50,
  productId: 0x6089,
  opened: true,
  open: jest.fn(),
  close: jest.fn(),
  // ... other required methods
};

const hackrf = new HackRFOne(mockDevice as USBDevice);
// Test configuration and error handling
```

See `src/hackrf/__tests__/` for comprehensive test examples.

## References

- **HackRF C Library**: [libhackrf on GitHub](https://github.com/greatscottgadgets/hackrf/blob/master/host/libhackrf/src/hackrf.c)
- **WebUSB API**: [MDN Documentation](https://developer.mozilla.org/en-US/docs/Web/API/USB)
- **Memory: HACKRF_DEVICE_INITIALIZATION_BUG_FIX**: Details on sample rate requirement
- **Memory: HACKRF_ERROR_HANDLING_ENHANCEMENT_2025**: Health checks and recovery
- **Memory: HACKRF_PROTECTIVE_MEASURES_IMPLEMENTATION**: Timeout protection
- **Test README**: `src/hackrf/__tests__/README.md` for testing patterns

## Support

If you encounter issues not covered here:

1. Check device with native tools:

   ```bash
   hackrf_info
   hackrf_transfer -r /dev/null -f 100000000 -n 1000000
   ```

2. Review console logs (development mode)
3. Check `DeviceDiagnostics` component for real-time status
4. Consult troubleshooting guide: `docs/reference/hackrf-troubleshooting.md`
