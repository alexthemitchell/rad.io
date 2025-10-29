# Device E2E Tests

This document describes the hardware-in-the-loop E2E tests for the rad.io visualizer with physical SDR devices.

## Overview

The device E2E tests validate the visualization functionality with a physical HackRF One device connected via WebUSB. These tests ensure that:

- Device connection works correctly
- Tuning to different frequencies operates as expected
- Gain controls function properly
- Visualization rendering remains stable with real hardware
- All visualization modes work with live RF data

## Prerequisites

1. **Physical HackRF One Device**: Connected via USB
2. **WebUSB Pairing**: Device must be previously paired with the browser
   - Navigate to `https://localhost:8080/monitor`
   - Click "Connect Device" and select your HackRF from the picker
   - Browser will remember the permission for future sessions
3. **RADIO_E2E_DEVICE Environment Variable**: Set to `1` to enable device tests

## Running Device Tests

### Using npm script (recommended)

```bash
npm run test:e2e:device
```

This will:

- Set `RADIO_E2E_DEVICE=1`
- Run only tests tagged with `@device`
- Skip tests if device is not detected

### Using Playwright directly

```bash
RADIO_E2E_DEVICE=1 npx playwright test --grep @device
```

### Run specific device test

```bash
RADIO_E2E_DEVICE=1 npx playwright test --grep "should tune to different frequencies"
```

### Run in headed mode (see the browser)

```bash
npm run test:e2e:device -- --headed
```

## Test Coverage

The device test suite validates:

### 1. Device Connection

- Auto-connection to previously paired device
- Device detection and initialization
- WebUSB permission handling

### 2. Start/Stop Reception

- Starting streaming with physical device
- Stopping streaming cleanly
- Verifying device state transitions

### 3. Frequency Tuning

- Tuning to different frequencies (e.g., FM radio band at 100 MHz)
- Verifying frequency changes are applied
- Ensuring visualization continues after tuning

### 4. Gain Control

- Adjusting LNA gain, VGA gain, or amp settings
- Verifying gain changes are applied to hardware
- Ensuring rendering stability after gain adjustments

### 5. Rendering Stability

- Continuous frame updates over time
- No memory leaks during extended streaming
- Consistent visualization performance

### 6. Visualization Modes

- Waterfall display with real RF data
- Spectrogram display with real RF data
- FFT display with real RF data
- Mode switching while streaming

### 7. IQ Constellation

- Rendering IQ constellation plot with real data
- Verifying constellation updates continuously

### 8. Device Reconnection

- Starting, stopping, and restarting streaming
- Verifying device can be reused across sessions
- Maintaining connection across page navigation

### 9. Scanner Functionality

- Initializing scanner with physical device
- Scanning frequency ranges with real hardware
- Detecting and displaying active signals
- Navigating to monitor from detected signals
- Handling different signal types (FM, AM, etc.)
- Real-time scanner result updates

### 10. Recording Features

- Starting/stopping recording from monitor
- Recording IQ data with physical device
- Displaying recording metadata (frequency, duration, timestamp)
- Playing back recorded IQ data
- Deleting and exporting recordings
- Filtering recordings by criteria

### 11. Advanced Device Controls

- Sample rate changes during streaming
- Bandwidth adjustments with device
- Frequency display in status bar
- Error recovery and graceful degradation

## Test Files

The device test suite consists of:

- **`e2e/visualization-device.spec.ts`**: Core visualization and device interaction tests (13 tests)
- **`e2e/scanner-device.spec.ts`**: Frequency scanning functionality tests (6 tests)
- **`e2e/recordings-device.spec.ts`**: Recording and playback tests (7 tests)

Total: 26 device tests covering end-to-end hardware integration

## Test Gating

The device tests are gated in two ways:

1. **Playwright Project Level**: The "device" project is only added to the Playwright config when `RADIO_E2E_DEVICE=1` is set
2. **Test Level**: Tests are skipped if `RADIO_E2E_DEVICE` is not set to `1`

This ensures:

- Device tests don't run in CI by default
- No extra Chrome instances are spawned when not needed
- Tests fail gracefully if hardware is not present

## Continuous Integration

Device tests are **not** run in CI by default. They are intended for:

- Local development with hardware
- Manual validation of device functionality
- Pre-release hardware testing

To run device tests in CI (if hardware is available):

```yaml
- name: Run Device E2E Tests
  env:
    RADIO_E2E_DEVICE: 1
  run: npm run test:e2e:device
```

## Troubleshooting

### Device not detected

**Problem**: Tests skip with "Device not detected"

**Solutions**:

1. Ensure HackRF is plugged in via USB
2. Verify device is paired in browser (visit monitor page and click "Connect Device")
3. Check that `RADIO_E2E_DEVICE=1` is set
4. Verify WebUSB is supported in your browser (Chrome, Edge, Opera)

### Tests timeout waiting for device

**Problem**: Tests hang waiting for device to initialize

**Solutions**:

1. Unplug and replug the HackRF device
2. Close other applications using the device
3. Check device firmware is up to date
4. Try a different USB cable or port

### Permission errors

**Problem**: WebUSB permission denied

**Solutions**:

1. Clear browser site data and re-pair device
2. Ensure you're using HTTPS (`https://localhost:8080`)
3. Don't run in incognito/private mode (permissions not persisted)

### Rendering tests fail

**Problem**: Frame comparison tests fail

**Solutions**:

1. Check that device is receiving RF signals (connect antenna)
2. Verify gain settings are not too low
3. Try tuning to a frequency with known activity (e.g., FM radio)

## Architecture

The device tests integrate with the existing test infrastructure:

- **Playwright Config**: `playwright.config.ts` defines the "device" project
- **Test File**: `e2e/visualization-device.spec.ts` contains all device tests
- **Utilities**: `src/utils/e2e.ts` provides helper functions
- **Device Context**: `src/contexts/DeviceContext.tsx` handles device management
- **WebUSB Hook**: `src/hooks/useHackRFDevice.ts` manages HackRF connection

## Future Enhancements

Potential improvements:

1. **Multi-Device Testing**: Support testing with multiple SDR devices
2. **Device Health Monitoring**: Track device metrics during tests
3. **RF Signal Injection**: Controlled RF signal generation for deterministic tests
4. **Performance Benchmarking**: Measure throughput, latency, and frame rates
5. **Automated Device Discovery**: Detect devices without manual pairing

## References

- [WebUSB API](https://developer.mozilla.org/en-US/docs/Web/API/USB)
- [HackRF One Documentation](https://hackrf.readthedocs.io/)
- [Playwright Testing](https://playwright.dev/)
- [rad.io WebUSB Integration](../WEBUSB_AUTO_CONNECT.md)
