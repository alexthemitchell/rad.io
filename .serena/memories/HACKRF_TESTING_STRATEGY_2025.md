# HackRF Testing Strategy Implementation (2025)

## Overview

Implemented comprehensive testing strategy for HackRF driver with hardware-gated and mocked tests, enabling thorough testing without physical device dependency while still supporting hardware validation when available.

## Architecture

### Test Categories

1. **Mocked Unit Tests** (Always run in CI/CD)
   - `HackRFOne.test.ts`: USB protocol tests
   - `HackRFOneAdapter.test.ts`: Adapter layer tests
   - `HackRFErrorRecovery.test.ts`: Error handling tests
   - `HackRFMocked.test.ts`: Edge cases and protocol compliance
2. **Hardware-Gated Tests** (Conditional)
   - `HackRFHardware.test.ts`: Physical device tests
   - Only run when `HACKRF_HARDWARE_TESTS=true`
   - Requires hackrf_info/hackrf_transfer CLI tools
   - Requires physical HackRF device connected

### Hardware Detection

Module: `src/hackrf/hardwareDetection.ts`

Key functions:

- `shouldRunHardwareTests()`: Check env variable
- `isHackRFCommandAvailable()`: Verify CLI tools installed
- `isHackRFDeviceConnected()`: Use hackrf_info to detect device
- `testHackRFStreaming()`: Test data capture with hackrf_transfer
- `getHackRFDeviceInfo()`: Parse device information
- `skipIfNoHardware()`: Helper for conditional test skipping

## Coverage Achievement

Successfully exceeded all thresholds:

- **HackRFOne.ts**: 81.36% statements (target: 72%), 97.56% functions (target: 94%)
- **HackRFOneAdapter.ts**: 94.44% statements (target: 93%), 91.17% functions (target: 87%)

Total: 116 HackRF tests (all passing)

## Running Tests

### Mocked Tests (No Hardware)

```bash
npm test -- src/hackrf/__tests__/
```

### Hardware Tests (With Device)

```bash
HACKRF_HARDWARE_TESTS=true npm test -- src/hackrf/__tests__/HackRFHardware.test.ts
```

### CI/CD Behavior

Hardware tests automatically skip in CI environments without device. Informational tests always run to report environment status.

## Test Patterns

### Mocked Device Creation

```typescript
function createMockUSBDevice(): {
  device: USBDevice;
  controlTransferOut: jest.Mock;
  controlTransferIn: jest.Mock;
  transferIn: jest.Mock;
};
```

### Hardware Test Skipping

```typescript
let shouldSkip: boolean;
beforeAll(async () => {
  shouldSkip = await skipIfNoHardware();
});

it("test name", async () => {
  if (shouldSkip) return;
  // test implementation
});
```

## Key Test Categories

1. **Configuration Validation**: Sample rate, frequency, bandwidth edge cases
2. **Protocol Compliance**: USB control transfer formatting, byte order
3. **Error Recovery**: Timeout handling, USB failures, fast recovery
4. **State Management**: Initialization, streaming state, device health
5. **Buffer Management**: Memory tracking, buffer clearing
6. **Hardware Integration**: Device detection, streaming, frequency sweeps

## Documentation

Comprehensive README at `src/hackrf/__tests__/README.md` covering:

- Test structure and categories
- Running instructions
- Hardware setup prerequisites
- Troubleshooting guide
- Adding new tests

## CI/CD Integration

Updated `.github/workflows/quality-checks.yml`:

- Documents hardware test skipping behavior
- Sets `HACKRF_HARDWARE_TESTS=false` explicitly
- Reports correct coverage thresholds in output

## Best Practices

1. **Mock for Logic**: Use mocks for protocol logic, state management, edge cases
2. **Hardware for Integration**: Use physical device for real-world validation
3. **Conditional Execution**: Always check skipIfNoHardware() in hardware tests
4. **Timeout Configuration**: Hardware tests need longer timeouts (15-60s)
5. **Informational Tests**: Always-run tests report environment status
6. **Coverage Maintenance**: Mocked tests maintain >80% coverage without hardware

## Troubleshooting

### Device Not Detected

1. Check USB connection (prefer USB 2.0)
2. Verify permissions (Linux udev rules)
3. Test with hackrf_info command
4. Reset device (unplug/replug)

### Tests Hang

1. Verify device health with CLI tools
2. Reset USB device
3. Reduce sample counts for debugging

## References

- Test documentation: `src/hackrf/__tests__/README.md`
- Hardware detection: `src/hackrf/hardwareDetection.ts`
- CI workflow: `.github/workflows/quality-checks.yml`
- HackRF C library: https://github.com/greatscottgadgets/hackrf/blob/master/host/libhackrf/src/hackrf.c
