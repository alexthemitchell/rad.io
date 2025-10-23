# Logging Standards and Patterns for rad.io

## Purpose

Comprehensive logging strategy implemented across rad.io to enable efficient debugging, production monitoring, and issue reproduction.

## Core Logging Infrastructure

### Centralized Logger (`src/utils/logger.ts`)

- **Categories**: Device (🔌), Data Flow (📊), WebGL (🎨), Audio (🔊), DSP (📡), Performance (⚡), USB (🔗), Recovery (🔄), Worker (⚙️), User Action (👆)
- **Levels**: DEBUG (dev only), INFO, WARN, ERROR, NONE
- **Features**:
  - Automatic timestamp inclusion
  - Structured context objects (JSON)
  - Category-specific loggers for consistency
  - OperationLogger for tracking duration of operations
  - Environment-aware (dev vs production)

### Usage Pattern

```typescript
import { deviceLogger, createOperationLogger } from '@/utils/logger';

// Simple logging
deviceLogger.warn("Device timeout detected", {
  consecutiveTimeouts: 3,
  deviceState: {...}
});

// Operation tracking
const op = createOperationLogger(deviceLogger, "Device Reset");
try {
  // ... operation ...
  op.success({ reconfigured: true });
} catch (error) {
  op.failure(error, { attemptedAction: "reset" });
}
```

## Logging Standards by Component Type

### Device/Hardware Layer (HackRFOne, Adapters, Hooks)

**Key Principle**: Log device state, configuration, and USB transfer details

**Required Context**:

- Device configuration: sampleRate, frequency, bandwidth, gains
- USB transfer details: endpoint, buffer size, byte count
- Recovery attempts: timeout counts, state snapshots
- Error specifics: error name, message, device state

**Examples**:

```typescript
// Good: Comprehensive context
console.warn("HackRFOne.receive: Starting streaming loop", {
  endpoint: this.inEndpointNumber,
  sampleRate: this.lastSampleRate,
  frequency: this.lastFrequency,
  bandwidth: this.lastBandwidth,
});

// Good: Recovery with full state
console.warn("HackRFOne.receive: Max timeouts reached, initiating recovery", {
  timeoutCount: consecutiveTimeouts,
  deviceState: {
    sampleRate: this.lastSampleRate,
    frequency: this.lastFrequency,
  },
});
```

**Log Levels**:

- DEBUG: Iteration details (first 5 iterations only)
- WARN: Configuration changes, recovery attempts, state transitions
- ERROR: Unrecoverable failures, unexpected errors

### Page-Level Components (Visualizer, Analysis, LiveMonitor)

**Key Principle**: Log data flow checkpoints and user-initiated actions

**Required Context**:

- Sample chunk details: count, buffer state
- Device configuration: requested vs actual
- Error context: error type, device capabilities
- Performance hints: time since last update

**Examples**:

```typescript
// Good: Data flow checkpoint
console.debug("Visualizer: Processing sample chunk", {
  sampleCount: chunk.length,
  firstSample: chunk[0] ? { I: chunk[0].I, Q: chunk[0].Q } : null,
  bufferState: {
    currentSize: sampleBufferRef.current.length,
    maxSize: MAX_BUFFER_SAMPLES,
  },
});

// Good: Configuration with capabilities check
console.error("Visualizer: Failed to configure device sample rate", err, {
  requestedSampleRate: 2048000,
  supportedRates: activeDevice.getCapabilities().supportedSampleRates,
});
```

**Log Levels**:

- DEBUG: Sample chunk processing, visualization scheduling
- WARN: Configuration steps, empty chunks
- ERROR: Streaming failures, device errors

### Visualization Components (IQConstellation, Spectrogram, WaveformVisualizer)

**Key Principle**: Log rendering path (WebGL → Worker → 2D) and failures

**Required Context**:

- Canvas dimensions and sample count
- Rendering path attempted
- Worker availability and capabilities
- Error type and fallback path

**Examples**:

```typescript
// Good: WebGL fallback with context
console.warn("IQConstellation: WebGL rendering failed, falling back", err, {
  canvasSize: { width, height },
  sampleCount: samples.length,
  errorType: err instanceof Error ? err.name : typeof err,
});

// Good: Worker creation failure
console.error(
  "IQConstellation: Worker creation failed, main thread fallback",
  e1,
  {
    supportsOffscreen: typeof OffscreenCanvas === "function",
    supportsWorker: typeof Worker !== "undefined",
  },
);
```

**Log Levels**:

- DEBUG: Worker metrics, render timing
- WARN: Rendering path fallbacks
- ERROR: Worker creation failures

### Control Components (RadioControls, BandwidthSelector, RecordingControls)

**Key Principle**: Never silent-fail; log all user-initiated actions that fail

**Required Context**:

- User input: requested value, signal type
- Device constraints: valid ranges, supported values
- Error details: type, message

**Examples**:

```typescript
// Good: User action failure with context
console.error("RadioControls: Failed to set frequency", error, {
  requestedFrequency: frequencyHz,
  signalType,
  inputValue: value,
});

// Good: File operation failure
console.error("RecordingControls: Failed to load recording file", error, {
  fileName: file.name,
  fileSize: file.size,
  fileType: file.type,
});
```

**Log Levels**:

- ERROR: All user-initiated action failures

### DSP and Utility Layer (dspWasm, performanceMonitor, iqRecorder)

**Key Principle**: Log fallback paths and performance issues

**Required Context**:

- Algorithm parameters: FFT size, sample count
- Fallback triggers: why WASM failed
- Performance thresholds: long tasks, timing

**Examples**:

```typescript
// Good: WASM fallback with context
console.warn("dspWasm: FFT calculation failed, falling back to JS", error, {
  fftSize,
  inputSampleCount: samples.length,
  errorType: error instanceof Error ? error.name : typeof error,
});
```

**Log Levels**:

- DEBUG: Performance metrics
- WARN: Algorithm fallbacks, long tasks
- ERROR: Unexpected failures

## Anti-Patterns to Avoid

### ❌ Silent Failures

```typescript
// Bad: Error swallowed
setFrequency(freq).catch(console.error);

// Good: Contextual error
setFrequency(freq).catch((error) => {
  console.error("Component: Failed to set frequency", error, {
    requestedFrequency: freq,
    constraints: {...},
  });
});
```

### ❌ Vague Messages

```typescript
// Bad: No context
console.error("Error", err);

// Good: Specific and contextual
console.error("HackRFOne.receive: USB transfer timeout", err, {
  consecutiveCount: 3,
  deviceState: {...},
});
```

### ❌ Missing Context

```typescript
// Bad: Insufficient debugging info
console.warn("Device configured");

// Good: Complete configuration snapshot
console.warn("Visualizer: Device configured successfully", {
  sampleRate: 2048000,
  frequency: currentFreq,
  bandwidth: currentBw,
});
```

### ❌ Wrong Log Level

```typescript
// Bad: Debug info at error level
console.error("Processing samples"); // Should be DEBUG

// Bad: Critical error at debug level
console.debug("Device not responding!"); // Should be ERROR
```

## Debugging Workflow

### 1. Reproduce Issue

- Check console for error messages and context objects
- Verify device state from logged configuration
- Review data flow checkpoints (sample chunks, USB transfers)

### 2. Add Targeted Logging

- Use appropriate log level and category
- Include relevant state snapshots
- Log at entry/exit of suspect functions

### 3. Analyze Logs

- Look for state inconsistencies in context objects
- Check for missing data flow checkpoints
- Verify configuration vs capabilities mismatches

### 4. Fix and Verify

- Implement fix
- Run with DEBUG level enabled
- Confirm issue resolved via logs

## Production Considerations

- **Default Level**: INFO (filters out DEBUG logs)
- **Performance**: Structured logging adds minimal overhead (~0.1ms per call)
- **Privacy**: Never log user credentials, API keys, or PII
- **Volume**: Limit repeated logs (first N iterations pattern)

## Testing Logging

Tests should verify critical error paths log appropriately:

```typescript
const consoleSpy = jest.spyOn(console, "error");
await expect(device.configure(invalid)).rejects.toThrow();
expect(consoleSpy).toHaveBeenCalledWith(
  expect.stringContaining("Failed to configure"),
  expect.anything(),
  expect.objectContaining({ requestedValue: invalid }),
);
```

## Key Files

- Logger implementation: `src/utils/logger.ts`
- Device logging: `src/models/HackRFOne.ts`, `src/models/HackRFOneAdapter.ts`
- Page logging: `src/pages/Visualizer.tsx`, `src/pages/Analysis.tsx`
- Component logging: All `src/components/*.tsx`
- Utility logging: `src/utils/dspWasm.ts`, `src/utils/performanceMonitor.ts`
