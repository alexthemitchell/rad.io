# HackRF Driver Testing

This directory contains comprehensive tests for the HackRF One SDR driver implementation.

## Test Structure

The tests are organized into three categories:

### 1. Unit Tests with Mocks (Always Run)

- **`HackRFOne.test.ts`** - Core HackRF USB protocol tests using mocked USB devices
- **`HackRFOneAdapter.test.ts`** - Adapter layer tests for ISDRDevice integration
- **`HackRFErrorRecovery.test.ts`** - Error handling and recovery logic tests
- **`HackRFMocked.test.ts`** - Additional mocked tests for edge cases and protocol compliance

These tests run in CI/CD and don't require physical hardware. They use Jest mocks to simulate USB device behavior and verify:

- USB control transfer formatting
- Configuration validation
- State management
- Error handling
- Buffer management
- Protocol compliance

### 2. Hardware-Gated Tests (Conditional)

- **`HackRFHardware.test.ts`** - Tests that require a physical HackRF device

These tests only run when:

1. `HACKRF_HARDWARE_TESTS=true` environment variable is set
2. HackRF command-line tools are installed (`hackrf_info`, `hackrf_transfer`)
3. A physical HackRF device is connected

Hardware tests verify:

- Device detection using native commands
- Data streaming using `hackrf_transfer`
- Device information retrieval
- Cross-spectrum frequency testing
- Sample count handling

## Running Tests

### Run All Tests (Mocked Only)

```bash
npm test -- src/hackrf/__tests__/
```

### Run Specific Test Suite

```bash
# Unit tests with mocks
npm test -- src/hackrf/__tests__/HackRFOne.test.ts
npm test -- src/hackrf/__tests__/HackRFOneAdapter.test.ts
npm test -- src/hackrf/__tests__/HackRFMocked.test.ts

# Hardware tests (requires device)
HACKRF_HARDWARE_TESTS=true npm test -- src/hackrf/__tests__/HackRFHardware.test.ts
```

### Run with Coverage

```bash
npm test -- src/hackrf/__tests__/ --coverage
```

## Hardware Test Setup

### Prerequisites

1. **Install HackRF Tools**

   ```bash
   # Ubuntu/Debian
   sudo apt-get install hackrf

   # macOS
   brew install hackrf

   # Arch Linux
   sudo pacman -S hackrf
   ```

2. **Connect HackRF Device**

   Connect your HackRF One via USB.

3. **Verify Device Detection**

   ```bash
   hackrf_info
   ```

   Expected output:

   ```
   Found HackRF
   Board ID Number: 2 (HackRF One)
   Firmware Version: 2021.03.1 (API:1.04)
   Part ID Number: 0xa000cb3c 0x00524f4b
   Serial Number: 0x0000000000000000088869dc2b7c125f
   ```

4. **Test Data Streaming**

   ```bash
   hackrf_transfer -r /dev/null -f 100000000 -n 1000000
   ```

### Running Hardware Tests

Enable hardware tests with the environment variable:

```bash
HACKRF_HARDWARE_TESTS=true npm test -- src/hackrf/__tests__/HackRFHardware.test.ts
```

### CI/CD Integration

In CI/CD environments without physical hardware, hardware tests automatically skip. The test suite includes informational tests that always run to report the test environment status:

```
=== HackRF Hardware Test Environment ===
HACKRF_HARDWARE_TESTS: false (not set)
hackrf_info available: no
Device connected: no

To enable hardware tests:
  HACKRF_HARDWARE_TESTS=true npm test
=========================================
```

## Test Coverage

Current coverage for HackRF implementation:

- **HackRFOne.ts**: 72% statements, 53% branches, 94% functions
- **HackRFOneAdapter.ts**: 93% statements, 83% branches, 87% functions

Coverage thresholds are enforced via `jest.config.js` and Codecov.

## Troubleshooting

### Device Not Detected

If `hackrf_info` doesn't detect your device:

1. **Check USB Connection**
   - Try different USB ports
   - Use USB 2.0 ports (USB 3.0 can cause issues)
   - Avoid USB hubs if possible

2. **Check USB Permissions** (Linux)

   ```bash
   # Add udev rule for HackRF
   sudo nano /etc/udev/rules.d/53-hackrf.rules
   # Add: ATTR{idVendor}=="1d50", ATTR{idProduct}=="6089", MODE="0666"
   sudo udevadm control --reload-rules
   sudo udevadm trigger
   ```

3. **Reset Device**
   - Unplug USB cable
   - Press reset button on HackRF
   - Reconnect USB cable

4. **Update Firmware**
   ```bash
   hackrf_spiflash -w hackrf_one_usb.bin
   ```

### Tests Hang During Streaming

If hardware tests hang during streaming:

1. **Check Device Health**

   ```bash
   hackrf_info
   hackrf_transfer -r /dev/null -f 100000000 -n 100000
   ```

2. **Reset USB Device**

   ```bash
   # Find USB bus/device
   lsusb | grep HackRF
   # Reset (replace XXX and YYY with actual values)
   sudo usb_modeswitch -v 0x1d50 -p 0x6089 -R
   ```

3. **Reduce Test Sample Counts**
   Edit `HackRFHardware.test.ts` and reduce sample counts for debugging.

## Adding New Tests

### Adding Mocked Tests

1. Create test cases in `HackRFMocked.test.ts` or create a new test file
2. Use `createMockUSBDevice()` helper to create mocked USB devices
3. Mock USB transfer methods as needed
4. Verify expected USB protocol behavior

Example:

```typescript
it("should format frequency correctly", async () => {
  const { device, controlTransferOut } = createMockUSBDevice();
  const hackRF = new HackRFOne(device);

  await hackRF.setFrequency(100_000_000);

  const [, data] = controlTransferOut.mock.calls[0] ?? [];
  const view = new DataView(data as ArrayBuffer);
  expect(view.getUint32(0, true)).toBe(100); // MHz
  expect(view.getUint32(4, true)).toBe(0); // Hz
});
```

### Adding Hardware Tests

1. Add test cases to `HackRFHardware.test.ts`
2. Use `shouldSkip` flag to conditionally skip tests
3. Use reasonable timeouts for hardware operations
4. Test across multiple frequencies/configurations

Example:

```typescript
it("should stream at custom frequency", async () => {
  if (shouldSkip) return;

  const success = await testHackRFStreaming(915_000_000, 100_000);
  expect(success).toBe(true);
}, 15000); // 15 second timeout
```

## References

- [HackRF Documentation](https://hackrf.readthedocs.io/)
- [HackRF C Library](https://github.com/greatscottgadgets/hackrf/blob/master/host/libhackrf/src/hackrf.c)
- [Memory: HACKRF_DEVICE_INITIALIZATION_BUG_FIX](.serena/memories/HACKRF_DEVICE_INITIALIZATION_BUG_FIX.md)
- [Memory: HACKRF_ERROR_HANDLING_ENHANCEMENT_2025](.serena/memories/HACKRF_ERROR_HANDLING_ENHANCEMENT_2025.md)
