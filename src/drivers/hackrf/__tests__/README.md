# HackRF Driver Testing

This directory contains comprehensive tests for the HackRF One WebUSB driver implementation.

## Test Structure

### 1. Unit Tests with Mocks (Always Run)

- **`HackRFOne.test.ts`** - Core USB protocol and control transfer tests
- **`HackRFOneAdapter.test.ts`** - Adapter layer for ISDRDevice integration
- **`HackRFErrorRecovery.test.ts`** - Error handling and recovery logic
- **`HackRFMocked.test.ts`** - Edge cases and protocol compliance

These tests run in CI/CD without physical hardware using Jest mocks to simulate USB device behavior.

### 2. Hardware-Gated Tests (Conditional)

- **`HackRFHardware.test.ts`** - WebUSB documentation and validation patterns

These tests document the expected WebUSB patterns and validate the approach. They skip automatically when `HACKRF_HARDWARE_TESTS!=true` or when WebUSB API is unavailable.

## Running Tests

### All Tests (Mocked Only)

```bash
npm test -- src/hackrf/__tests__/
```

### With Coverage

```bash
npm test -- src/hackrf/__tests__/ --coverage
```

### Hardware Tests (Documentation)

```bash
HACKRF_HARDWARE_TESTS=true npm test -- src/hackrf/__tests__/HackRFHardware.test.ts
```

Note: Hardware tests are informational and document WebUSB patterns. Actual hardware validation happens through manual testing with the browser UI.

## Writing Tests

### Mocked Tests Pattern

```typescript
// Create mock USB device
const { device, controlTransferOut } = createMockUSBDevice();
const hackRF = new HackRFOne(device);

// Test USB protocol behavior
await hackRF.setFrequency(100_000_000);

// Verify correct USB commands sent
expect(controlTransferOut).toHaveBeenCalledWith(
  expect.objectContaining({
    request: VendorRequest.SET_FREQ,
  }),
  expect.any(ArrayBuffer),
);
```

### Testing Approach

The project uses **WebUSB-based testing** rather than external CLI tools:

- ✅ Mock WebUSB device objects for unit tests
- ✅ Test USB protocol formatting and state management
- ✅ Document expected WebUSB patterns in hardware tests
- ❌ No external HackRF_info or HackRF_transfer commands
- ❌ No forking/exec of system processes

This approach aligns with the project's goal of creating a pure browser-based SDR driver that doesn't depend on external native tools.

## Key Test Patterns

### USB Protocol Tests

Verify that control transfers are correctly formatted per HackRF protocol:

```typescript
it("formats frequency command correctly", async () => {
  await hackRF.setFrequency(915_000_000);

  const [, data] = controlTransferOut.mock.calls[0] ?? [];
  const view = new DataView(data as ArrayBuffer);

  // Frequency split into MHz and Hz components
  expect(view.getUint32(0, true)).toBe(915); // MHz
  expect(view.getUint32(4, true)).toBe(0); // Hz
});
```

### State Management Tests

Verify device initialization and lifecycle:

```typescript
it("requires sample rate before streaming", async () => {
  const hackRF = new HackRFOne(device);

  // Should reject without sample rate
  await expect(hackRF.receive()).rejects.toThrow(/Sample rate/);

  // Should succeed after configuration
  await hackRF.setSampleRate(20_000_000);
  // Now receive() can be called
});
```

### Error Recovery Tests

Verify robust error handling:

```typescript
it("handles USB timeouts with retry", async () => {
  // Mock timeout on first call
  transferIn.mockRejectedValueOnce(new Error("timeout"));
  transferIn.mockResolvedValueOnce({ data, status: "ok" });

  const receivePromise = hackRF.receive();
  await new Promise((resolve) => setTimeout(resolve, 100));

  hackRF.stopRx();
  await expect(receivePromise).resolves.toBeUndefined();
});
```

## WebUSB Integration

### Critical Initialization Sequence

Per the WebUSB SDR integration playbook, HackRF devices require this exact sequence:

1. `await device.open()`
2. `await device.selectConfiguration(1)`
3. `await device.claimInterface(0)`
4. `await device.setSampleRate(20_000_000)` ← **CRITICAL: Must be first**
5. `await device.setFrequency(100_000_000)`
6. Optional: `setBandwidth`, `setLNAGain`, `setAmpEnable`
7. `await device.receive(callback)`

### Sample Format

- **Type**: Signed 8-bit integers (Int8Array)
- **Layout**: Interleaved I/Q pairs
- **Conversion**: `value / 128.0` to normalize to ±1.0 range

### Common Patterns

**Device Detection**:

```typescript
const devices = await navigator.usb.getDevices();
const hackrf = devices.find(
  (d) => d.vendorId === 0x1d50 && d.productId === 0x6089,
);
```

**Streaming Loop**:

```typescript
while (this.streaming) {
  const result = await device.transferIn(endpoint, 4096);
  if (result.data) {
    const samples = this.parseSamples(result.data);
    callback(samples);
  }
}
```

## References

- [WebUSB API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/USB)
- [HackRF C Reference](https://github.com/greatscottgadgets/hackrf/blob/master/host/libhackrf/src/hackrf.c)
- [HackRF Documentation](https://hackrf.readthedocs.io/)
- Memory: `WEBUSB_SDR_INTEGRATION_PLAYBOOK`
- Memory: `HACKRF_DEVICE_INITIALIZATION_BUG_FIX`
