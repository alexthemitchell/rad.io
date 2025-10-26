# HackRF Initialization Flow Optimization (October 2025)

## Summary

Implemented mandatory initialization sequence enforcement and validation for HackRF devices to prevent silent failures and ensure reliable streaming.

## Key Changes

### 1. Initialization State Tracking (HackRFOneAdapter)
- Added `isInitialized` flag set when `setSampleRate()` is called
- Prevents `receive()` from starting without proper initialization
- Reset on `close()` and `reset()` to require reconfiguration

### 2. Configuration Sequence Enforcement
**Critical Order**: Sample rate → Frequency → Optional settings

**Before**: Config applied in receive() was: frequency, sample rate, bandwidth, gains
**After**: Config now applies: sample rate, frequency, bandwidth, gains

This fixes race condition where frequency could be set before sample rate.

### 3. Enhanced Validation

**HackRFOneAdapter.validateInitialization()**: 
- Checks `isInitialized` flag before allowing receive()
- Clear error: "HackRF device not initialized. Must call setSampleRate() before receive()."

**HackRFOne.validateDeviceHealth()**:
- Added check for `lastSampleRate !== null`
- Error explains transferIn() will hang without sample rate

### 4. Development Logging
Added conditional logging in HackRFOne for:
- `setSampleRate()`: Shows sample rate in MSPS, freqHz, divider
- `setFrequency()`: Shows frequency in MHz, mhz/hz components

Only active when `NODE_ENV === "development"`.

## Testing

Added 12 new tests covering:
- Initialization validation (throw error without sample rate)
- State reset on close()/reset()
- Configuration sequence order (sample rate before frequency)
- Range validation for sample rate (2-20 MSPS) and frequency (1 MHz - 6 GHz)
- Device capabilities

All 15 tests pass. Type-check, lint, format, and build all pass.

## Why This Matters

**HackRF Critical Requirement**: Sample rate MUST be set before receive() or transferIn() hangs forever.

Previous code had race conditions where:
1. Pages called `device.setSampleRate()` in beginDeviceStreaming()
2. But also had useEffect that configured device separately
3. Adapter's receive() could apply config in wrong order

New code guarantees:
1. Sample rate is always set first
2. Validation prevents streaming without initialization
3. Clear error messages guide users to fix issues

## Code Locations

- `src/hackrf/HackRFOneAdapter.ts`: Initialization tracking and sequence enforcement
- `src/hackrf/HackRFOne.ts`: Enhanced validation and logging
- `src/hackrf/__tests__/HackRFOne.test.ts`: Core functionality tests
- `src/hackrf/__tests__/HackRFOneAdapter.test.ts`: Adapter initialization tests

## Best Practices for Future Work

1. Always call `setSampleRate()` before any streaming operation
2. Use adapter's receive() config parameter for one-shot configuration
3. Avoid separate useEffect hooks that configure device in parallel
4. Check error messages - they now explain exactly what's missing
5. Development logs show configuration sequence for debugging

## References

- Issue: "Optimize HackRF initialization and configuration flows"
- Related memories: HACKRF_DEVICE_INITIALIZATION_BUG_FIX, HACKRF_PROTECTIVE_MEASURES_IMPLEMENTATION
- HackRF C reference: https://github.com/greatscottgadgets/hackrf/blob/master/host/libhackrf/src/hackrf.c
