# HackRF Error Handling Enhancement (October 2025)

## Summary

Enhanced the already-robust HackRF error handling implementation with public APIs for manual recovery, comprehensive validation utilities, and extensive documentation. The existing implementation already included automatic timeout recovery, device health checks, and UI diagnostics.

## What Was Already Implemented

The HackRF driver already had comprehensive error handling:

- `reset()` method for software device reset
- `fastRecovery()` private method for automatic recovery with state restoration
- `validateDeviceHealth()` for pre-streaming checks
- Timeout protection (5s) with Promise.race
- Consecutive timeout tracking (3 attempts before auto-recovery)
- DeviceDiagnostics UI component with troubleshooting steps
- Error propagation from HackRFOne → Adapter → UI
- Development-mode conditional logging

## Enhancements Added

### 1. Public fastRecovery() API

**Location**: `src/hackrf/HackRFOne.ts` (line ~721)

Made `fastRecovery()` public instead of private, allowing applications to manually trigger recovery:

```typescript
async fastRecovery(): Promise<void>
```

This performs:

1. USB reset command
2. 150ms stabilization delay
3. Restore all configuration (sample rate, frequency, bandwidth, gains, amp)
4. Set transceiver mode to RECEIVE

**Rationale**: Some error scenarios may benefit from manual recovery invocation rather than waiting for automatic timeout-based recovery.

### 2. Configuration Status API

**Location**: `src/hackrf/HackRFOne.ts` (after validateDeviceHealth)

```typescript
getConfigurationStatus(): {
  isOpen: boolean;
  isStreaming: boolean;
  isClosing: boolean;
  sampleRate: number | null;
  frequency: number | null;
  bandwidth: number | null;
  lnaGain: number | null;
  ampEnabled: boolean;
  isConfigured: boolean; // true if sample rate is set
}
```

**Use Cases**:

- Pre-flight checks before streaming
- Diagnostics display
- Debugging device state issues

### 3. Pre-Streaming Validation API

**Location**: `src/hackrf/HackRFOne.ts` (after getConfigurationStatus)

```typescript
validateReadyForStreaming(): {
  ready: boolean;
  issues: string[];
}
```

Checks:

- Device is open
- Device is not closing
- Sample rate is configured (critical!)
- Device is not already streaming

Returns detailed list of issues if not ready, enabling targeted error messages.

### 4. ISDRDevice Interface Update

**Location**: `src/models/SDRDevice.ts` (line ~207)

Added optional method to interface:

```typescript
fastRecovery?(): Promise<void>;
```

Optional because not all SDR devices may support this pattern. HackRFOneAdapter implements it.

### 5. HackRFOneAdapter Methods

**Location**: `src/hackrf/HackRFOneAdapter.ts` (line ~268)

Added public fastRecovery() method:

```typescript
async fastRecovery(): Promise<void> {
  await this.device.fastRecovery();
  // Keep isInitialized=true since fastRecovery restores config
}
```

Key difference from `reset()`:

- `reset()` sets `isInitialized=false` (requires reconfiguration)
- `fastRecovery()` keeps `isInitialized=true` (config restored automatically)

### 6. Comprehensive Test Suite

**Location**: `src/hackrf/__tests__/HackRFErrorRecovery.test.ts` (new file, 22 tests)

Test coverage for:

- Device configuration status tracking
- Pre-streaming validation
- Reset functionality
- Fast recovery with state restoration
- Error detection and reporting
- Configuration state tracking
- Error propagation through adapter
- Interface compliance

All tests pass (1138/1138 total in project).

### 7. Troubleshooting Documentation

**Location**: `docs/reference/hackrf-troubleshooting.md` (new file, 12KB)

Comprehensive guide covering:

**Common Error States**:

1. Device Not Responding (timeout)
2. Sample Rate Not Configured
3. Device Not Open
4. Configuration Failures
5. Firmware Compatibility
6. Power Issues
7. WebUSB Permission Issues

**For Each Error**:

- Symptoms
- Root causes
- Automatic recovery (if applicable)
- Manual recovery steps (prioritized)
- Technical details

**Additional Content**:

- Error recovery workflow diagram
- Diagnostic logging guide
- Best practices for users and developers
- Reference materials (official docs, internal memories)
- Error code appendix

**Updated**: `docs/reference/README.md` to link new guide under "For Users"

## Key Implementation Patterns

### State Tracking for Recovery

HackRFOne maintains last-known configuration:

```typescript
private lastSampleRate: number | null = null;
private lastFrequency: number | null = null;
private lastBandwidth: number | null = null;
private lastLNAGain: number | null = null;
private lastAmpEnabled: boolean = false;
```

Updated on every configuration method call, enabling seamless recovery.

### Validation Before Action

Both validateDeviceHealth() and validateReadyForStreaming() check prerequisites before operations:

```typescript
private validateDeviceHealth(): void {
  if (!this.usbDevice.opened) throw new Error("Device is not open");
  if (this.closing) throw new Error("Device is closing");
  if (this.lastSampleRate === null) throw new Error("Sample rate not configured");
}
```

Called at start of `receive()` to fail fast with clear error messages.

### Optional Interface Methods

Using optional methods in ISDRDevice allows graceful feature detection:

```typescript
if (device.fastRecovery) {
  await device.fastRecovery();
} else {
  // Fall back to full reset
  await device.reset();
}
```

## Testing Strategy

Mock USB device with configurable behaviors:

```typescript
function createMockUSBDevice(options?: {
  transferInBehavior?: "success" | "timeout" | "error";
});
```

Allows testing:

- Normal operation
- Timeout scenarios
- USB communication errors
- Reset command verification
- State transitions

## Code Quality

All quality gates passed:

- ✅ Tests: 1138/1138 passing
- ✅ Lint: No errors
- ✅ Type-check: No errors
- ✅ All new code has JSDoc comments
- ✅ Follows existing patterns

## User-Facing Impact

### Before Enhancement

- Automatic recovery worked but was opaque
- No API to manually trigger recovery
- No way to check device configuration status
- Limited troubleshooting documentation

### After Enhancement

- Can manually trigger fast recovery via API
- Can query detailed device configuration status
- Can validate readiness before streaming
- Comprehensive troubleshooting guide with recovery workflows
- Better error messages with actionable guidance

## Developer-Facing Impact

### New APIs Available

```typescript
// Check device configuration state
const status = device.getConfigurationStatus();
if (!status.isConfigured) {
  console.log("Sample rate must be set");
}

// Validate before streaming
const validation = device.validateReadyForStreaming();
if (!validation.ready) {
  console.log("Issues:", validation.issues);
}

// Manual recovery
try {
  await device.fastRecovery();
  console.log("Recovery successful");
} catch (error) {
  // Fall back to physical reset
}
```

### Testing Utilities

New test file demonstrates patterns for testing error recovery scenarios with mocked USB devices.

## Documentation Quality

Troubleshooting guide includes:

- Clear error categorization
- Prioritized recovery steps (software → hardware)
- Workflow diagrams (ASCII art)
- Diagnostic logging examples
- Best practices section
- Version history

Follows rad.io documentation standards with proper internal cross-references.

## Future Enhancements

Potential additions (not required for this issue):

1. **Error telemetry**: Track error rates and recovery success
2. **Retry policies**: Configurable retry counts and backoff strategies
3. **Device health metrics**: USB transfer latency, success rates
4. **Automatic firmware check**: Detect outdated firmware versions
5. **Recovery history**: Log past recovery attempts for diagnostics

## Related Work

- Memory: `HACKRF_DEVICE_INITIALIZATION_BUG_FIX` - Original device hang issue
- Memory: `HACKRF_PROTECTIVE_MEASURES_IMPLEMENTATION` - Timeout protection
- Memory: `WEBUSB_SDR_INTEGRATION_PLAYBOOK` - WebUSB patterns
- ADR-0011: Error Handling and Resilience Strategy

## Verification

```bash
npm test                    # 1138/1138 tests pass
npm run lint                # No errors
npm run type-check          # No errors
```

## Key Takeaway

The HackRF driver already had excellent error handling. This enhancement made existing recovery mechanisms more accessible through public APIs, added validation utilities for proactive error prevention, and documented the comprehensive error recovery patterns for users and developers.
