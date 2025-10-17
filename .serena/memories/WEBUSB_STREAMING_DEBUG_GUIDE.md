# WebUSB Device Streaming Debugging Guide

## Common Symptoms & Solutions

### Symptom: Device Shows "Receiving" but No Data

**Root Causes**:

1. Sample rate not configured (most common for HackRF)
2. Device in wrong transceiver mode
3. Hardware not actually streaming (needs reset)
4. USB endpoint misconfigured

**Diagnostic Steps**:

```typescript
// 1. Add logging before transferIn
console.warn("About to call transferIn on endpoint", endpointNumber);

// 2. Add timeout wrapper
const transferWithTimeout = Promise.race([
  device.transferIn(endpoint, size),
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Transfer timeout")), 5000),
  ),
]);

// 3. Check result structure
const result = await device.transferIn(endpoint, size);
console.warn({
  status: result.status,
  hasData: !!result.data,
  byteLength: result.data?.byteLength || 0,
});
```

### Symptom: transferIn() Hangs Forever

**Common Causes**:

- Missing configuration (sample rate, etc.)
- Device firmware not responding
- USB communication stalled
- Wrong endpoint or interface

**Solutions**:

1. Ensure all required device configuration is set
2. Add timeout to prevent UI freezing
3. Verify endpoint number is correct for direction (in/out)
4. Check device.opened and device.configuration state

### Symptom: Data Received but Visualizations Empty

**Check These**:

1. Sample parsing: `parseSamples()` returning empty array?
2. Data format: Int8 vs Uint8 vs Int16?
3. State updates: Are React states being set?
4. Sample threshold: Components checking `samples.length > 0`?

**Debugging Code**:

```typescript
const parsed = device.parseSamples(data);
console.warn("Parsed samples:", {
  count: parsed.length,
  firstSample: parsed[0],
  format: typeof parsed[0]?.I,
  range: [
    Math.min(...parsed.map((s) => s.I)),
    Math.max(...parsed.map((s) => s.I)),
  ],
});
```

## WebUSB Best Practices

### Configuration Order

For SDR devices, always follow this sequence:

```typescript
// 1. Open device and claim interface
await device.open();
await device.selectConfiguration(1);
await device.claimInterface(0);

// 2. Configure device parameters (CRITICAL ORDER)
await device.setSampleRate(20000000); // MUST be first for HackRF
await device.setFrequency(100000000);
await device.setBandwidth(20000000); // Optional
await device.setLNAGain(16); // Optional
await device.setAmpEnable(false); // Optional

// 3. Start streaming
await device.receive(callback);
```

### Error Handling

```typescript
try {
  const result = await device.transferIn(endpoint, size);

  if (result.status !== "ok") {
    console.error("Transfer status not ok:", result.status);
    // Handle stall, babble, etc.
  }

  if (!result.data || result.data.byteLength === 0) {
    console.warn("No data received in transfer");
    // Check device configuration
  }
} catch (err) {
  if (err.name === "AbortError") {
    // Expected during shutdown
  } else if (err.name === "NetworkError") {
    // Device disconnected
  } else {
    console.error("Transfer error:", err);
    // Unexpected error
  }
}
```

### Streaming Loop Pattern

```typescript
async receive(callback: (data: DataView) => void): Promise<void> {
  this.streaming = true;
  let consecutiveErrors = 0;

  while (this.streaming) {
    try {
      const result = await this.device.transferIn(this.endpoint, 4096);

      if (result.data) {
        consecutiveErrors = 0; // Reset error counter
        callback(result.data);
      } else {
        consecutiveErrors++;
        if (consecutiveErrors > 10) {
          throw new Error("Too many empty transfers");
        }
      }

    } catch (err) {
      if (err.name === "AbortError") {
        break; // Clean shutdown
      }
      console.error("Transfer error:", err);
      break; // Exit on error
    }
  }

  // Cleanup
  await this.setTransceiverMode(OFF);
}
```

## Hardware-Specific Notes

### HackRF One

**Required Configuration**:

- Sample Rate: MANDATORY (1.75M - 28M Hz)
- Frequency: Required (1 MHz - 6 GHz)
- Transceiver Mode: Set to RECEIVE (1)

**Initialization Sequence**:

```typescript
await device.setSampleRate(20000000); // MUST be first!
await device.setFrequency(100000000);
await device.setTransceiverMode(RECEIVE); // Automatic in receive()
```

**Sample Format**:

- Type: Int8 (signed bytes)
- Layout: Interleaved I, Q, I, Q, ...
- Range: -128 to +127
- Conversion: value / 128.0 → ±1.0

**Common Issues**:

- Device needs reset after firmware errors
- USB 3.0 ports work better than USB 2.0
- Some USB hubs cause problems

### RTL-SDR

**Sample Format**:

- Type: Uint8 (unsigned bytes)
- Layout: Interleaved I, Q, I, Q, ...
- Range: 0 to 255 (127 = zero)
- Conversion: (value - 127) / 128.0 → ±1.0

## Memory Management

### Buffer Tracking

```typescript
private activeBuffers = new Set<DataView>();

trackBuffer(buffer: DataView): void {
  this.activeBuffers.add(buffer);
}

clearBuffers(): void {
  this.activeBuffers.clear();
}

getMemoryInfo(): { activeBuffers: number; totalBytes: number } {
  return {
    activeBuffers: this.activeBuffers.size,
    totalBytes: Array.from(this.activeBuffers)
      .reduce((sum, buf) => sum + buf.byteLength, 0)
  };
}
```

### React State Management

```typescript
// Use refs for high-frequency updates
const sampleBufferRef = useRef<Sample[]>([]);
const latestChunkRef = useRef<Sample[]>([]);

// Throttle state updates to 30 FPS
const UPDATE_INTERVAL_MS = 33;
let lastUpdate = 0;

function handleSamples(chunk: Sample[]) {
  sampleBufferRef.current = chunk;

  const now = performance.now();
  if (now - lastUpdate >= UPDATE_INTERVAL_MS) {
    lastUpdate = now;
    setSamples([...sampleBufferRef.current]); // Trigger re-render
  }
}
```

## Testing Strategies

### Verify Device Without Web App

```bash
# HackRF
hackrf_info                    # Check detection
hackrf_transfer -r test.bin -f 100000000 -n 1000000

# RTL-SDR
rtl_test -t                    # Check detection
rtl_sdr -f 100000000 -s 2048000 -n 1000000 test.bin
```

### Synthetic Testing

```typescript
// Test without hardware
function simulateDevice() {
  return {
    async receive(callback) {
      const interval = setInterval(() => {
        const data = new DataView(new ArrayBuffer(8192));
        // Fill with test pattern
        for (let i = 0; i < data.byteLength; i++) {
          data.setInt8(i, Math.sin(i * 0.1) * 127);
        }
        callback(data);
      }, 10);

      return () => clearInterval(interval);
    },
  };
}
```

### Logging Checklist

When debugging streaming issues, log:

1. Device connection state
2. Configuration values (sample rate, frequency, etc.)
3. Endpoint numbers and directions
4. Transfer sizes requested vs received
5. Data format and byte lengths
6. Callback execution and timing
7. State update frequency

## Performance Optimization

### Efficient Data Processing

```typescript
// Bad: Creates new array every time
samples = samples.concat(newChunk);

// Good: Use pre-allocated buffer
if (samples.length + newChunk.length > MAX_SIZE) {
  samples = samples.slice(newChunk.length);
}
samples.push(...newChunk);

// Better: Use typed arrays
const buffer = new Float32Array(MAX_SIZE);
let writeIndex = 0;

function addSamples(newSamples: Float32Array) {
  const remaining = buffer.length - writeIndex;
  if (newSamples.length > remaining) {
    // Circular buffer
    buffer.copyWithin(0, newSamples.length);
    writeIndex -= newSamples.length;
  }
  buffer.set(newSamples, writeIndex);
  writeIndex += newSamples.length;
}
```

### Visualization Throttling

```typescript
// Throttle React updates to avoid re-render storms
const [samples, setSamples] = useState<Sample[]>([]);
const rafId = useRef<number>();

function scheduleUpdate(newSamples: Sample[]) {
  if (rafId.current) return; // Already scheduled

  rafId.current = requestAnimationFrame(() => {
    rafId.current = undefined;
    setSamples(newSamples);
  });
}
```
