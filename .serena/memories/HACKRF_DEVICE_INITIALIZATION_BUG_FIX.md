# HackRF Device Initialization Critical Bug Fix (October 2025)

## Problem Summary

The application showed "Receiving" status after device connection, but visualizations never displayed data. Despite the UI indicating active reception, no IQ samples reached the visualization components.

## Root Cause Analysis

### Primary Issue: Missing Sample Rate Configuration

**Critical Finding**: HackRF devices **REQUIRE** a sample rate to be configured before they will stream data via `transferIn()`. The sample rate was never being set before calling `device.receive()`.

**Evidence**:

1. WebUSB `transferIn()` call hung indefinitely (never resolved)
2. No errors thrown - just infinite waiting
3. Device showed "Receiving" status (software state was correct)
4. After setting sample rate to 20 MSPS, device behavior changed

### Secondary Issue: Race Condition in Device Configuration

The device configuration (`setFrequency`, `setBandwidth`, `setAmpEnable`) was happening in a separate `useEffect` that ran in parallel with `beginDeviceStreaming()`. This created a race condition where streaming could start before configuration completed.

## Fix Implementation

### Location: `src/pages/Visualizer.tsx`

**Changed in `beginDeviceStreaming()` function:**

```typescript
const beginDeviceStreaming = useCallback(
  async (activeDevice: ISDRDevice): Promise<void> => {
    clearVisualizationState();
    setListening(true);
    setLiveRegionMessage("Started receiving radio signals");

    // CRITICAL FIX: Ensure device is configured with sample rate before starting
    console.warn("beginDeviceStreaming: Configuring device before streaming");
    try {
      await activeDevice.setSampleRate(20000000); // 20 MSPS default
      console.warn("beginDeviceStreaming: Sample rate set to 20 MSPS");
    } catch (err) {
      console.error("Failed to set sample rate:", err);
    }

    const receivePromise = activeDevice.receive((data) => {
      const parsed = activeDevice.parseSamples(data) as Sample[];
      handleSampleChunk(parsed);
    });
    // ... rest of implementation
  },
  [clearVisualizationState, handleSampleChunk],
);
```

## HackRF Device Requirements

### Mandatory Initialization Sequence

For HackRF to stream data, the following MUST be configured **before** calling `receive()`:

1. **Sample Rate** (CRITICAL): `await device.setSampleRate(rate)`
   - Default: 20 MSPS (20000000 Hz)
   - Supported rates: 1.75M - 28M Hz
   - Without this, `transferIn()` will hang forever

2. **Frequency** (Required): `await device.setFrequency(freq)`
   - Range: 1 MHz - 6 GHz
   - Determines center frequency for reception

3. **Transceiver Mode** (Automatic in `receive()`): Set to RECEIVE mode
   - Command: `SET_TRANSCEIVER_MODE = 1`
   - Value: `TransceiverMode.RECEIVE`

### Optional Configuration

4. **Bandwidth Filter**: `await device.setBandwidth(bw)`
   - Default: 20 MHz
   - Affects baseband filter

5. **LNA Gain**: `await device.setLNAGain(gain)`
   - Range: 0-40 dB (8 dB steps)
   - Affects signal amplification

6. **Amplifier**: `await device.setAmpEnable(enabled)`
   - Boolean flag
   - Additional signal amplification

## Debugging Process

### Diagnostic Approach Used

1. **Added console logging** at each stage of data flow:
   - Device initialization
   - Sample rate configuration
   - Streaming loop start
   - transferIn() calls
   - Data reception
   - Sample parsing
   - Visualization updates

2. **Traced the data flow** from hardware to UI:

   ```
   HackRF Hardware
   ↓
   USB transferIn() [HUNG HERE]
   ↓
   receive() callback
   ↓
   parseSamples()
   ↓
   handleSampleChunk()
   ↓
   scheduleVisualizationUpdate()
   ↓
   React state update (samples)
   ↓
   Visualization components
   ```

3. **Identified the hang point**: `await this.usbDevice.transferIn(endpoint, 4096)` never returned

4. **Hypothesis testing**:
   - ✅ Device connected successfully (verified via USB state)
   - ✅ Endpoint number correct (1 for bulk in)
   - ✅ Transceiver mode set to RECEIVE
   - ❌ Sample rate never configured

### Key Diagnostic Tools

**Console Messages Added**:

```typescript
console.warn(
  `HackRFOne.receive: Starting streaming loop, endpoint=${this.inEndpointNumber}`,
);
console.warn(`HackRFOne.receive: Iteration ${count}, calling transferIn`);
console.warn(`HackRFOne.receive: transferIn result:`, {
  status,
  byteLength,
  hasData,
});
```

**Result**: Saw "Iteration 1, calling transferIn" but never saw the result message, confirming the hang.

## Lessons Learned

### Critical Requirements for SDR Devices

1. **Sample rate configuration is mandatory** - not optional for HackRF
2. **Configuration order matters** - some settings must be applied before streaming
3. **Silent failures** - WebUSB doesn't throw errors when device isn't configured, just hangs
4. **Hardware initialization sequences** must be followed exactly

### Best Practices for Device Integration

1. **Always set sample rate first** before any streaming operation
2. **Synchronous configuration** - await all setup before starting streaming
3. **Add timeout protection** for USB operations that can hang
4. **Comprehensive logging** during development for hardware debugging
5. **Reference official implementations** (libhackrf C library) for initialization sequences

### Testing Recommendations

1. **Test with actual hardware** - simulators don't catch these issues
2. **Log the full USB transaction sequence** when debugging
3. **Verify each configuration step** before proceeding
4. **Add assertions** for critical pre-conditions
5. **Document hardware requirements** prominently in code comments

## Remaining Issues

### Hardware-Level Problems

Even with sample rate configured, some users may still experience `transferIn()` hanging if:

1. **Device needs physical reset** - unplug/replug USB or press reset button
2. **Firmware incompatibility** - ensure HackRF firmware is up to date
3. **Driver issues** - verify device works with `hackrf_info` and `hackrf_transfer`
4. **USB port problems** - try different USB ports or hubs
5. **Power issues** - some USB ports don't provide enough power

### Verification Commands

Users should verify their HackRF works with native tools before using the web app:

```bash
# Check device detection
hackrf_info

# Test data streaming
hackrf_transfer -r /dev/null -f 100000000 -n 1000000
```

## Code Locations

### Modified Files

1. `src/pages/Visualizer.tsx`
   - Line ~137-151: `beginDeviceStreaming()` function
   - Added sample rate configuration before calling `receive()`

2. `src/models/HackRFOne.ts`
   - Line ~410-443: `receive()` method
   - Added debug logging (should be removed in production)

### Key Classes

- `HackRFOne` (`src/models/HackRFOne.ts`): Low-level USB communication
- `HackRFOneAdapter` (`src/models/HackRFOneAdapter.ts`): ISDRDevice adapter
- `Visualizer` (`src/pages/Visualizer.tsx`): Main application page with device lifecycle

## Future Improvements

1. **Add timeout to transferIn()** - prevent infinite hangs
2. **Device health check** - verify configuration before streaming
3. **Better error messages** - detect and report configuration issues
4. **Initialization validation** - assert required settings are configured
5. **Recovery mechanism** - auto-retry with proper configuration
6. **User-facing diagnostics** - show configuration status in UI

## References

- HackRF C Library: https://github.com/greatscottgadgets/hackrf/blob/master/host/libhackrf/src/hackrf.c
- WebUSB API: https://developer.mozilla.org/en-US/docs/Web/API/USB
- Sample Rate Computation: `src/models/HackRFDevice/util.ts` - `computeSampleRateParams()`
