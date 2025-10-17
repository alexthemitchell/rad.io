# SDR Sample Rate Configuration Guide

## Critical Discovery: Browser-Feasible Sample Rates

**Problem**: Using 20 MSPS (20,000,000 samples/second) sample rate caused:

- Audio playback failure (no audible sound)
- Excessive CPU load for real-time browser demodulation
- Misalignment between SDR rate and AudioStreamProcessor expectations

**Root Cause**: Real-time FM/AM demodulation in browser requires decimation from SDR rate to 48kHz audio. With 20 MSPS:

- Decimation ratio: ~417:1 (20,000,000 / 48,000)
- Processing overhead too high for browser JavaScript runtime
- AudioStreamProcessor initialized with wrong sample rate

**Solution**: Use 2.048 MSPS (2,048,000 samples/second) for browser applications:

- Decimation ratio: ~42:1 (practical for real-time)
- CPU-efficient processing in browser
- Maintains adequate bandwidth for FM broadcasts (±200 kHz)
- Proper alignment with audio processing pipeline

## Implementation Pattern

### Location: `src/pages/Visualizer.tsx`

**1. Audio Processing Initialization** (lines ~70-84):

```typescript
audioProcessorRef.current = new AudioStreamProcessor(2048000); // SDR rate
```

**2. Device Configuration Before Streaming** (lines ~319-365):

```typescript
const beginDeviceStreaming = async (device: ISDRDevice) => {
  await activeDevice.setSampleRate(2048000); // Critical: set before receive()
  console.warn("Sample rate set to 2.048 MSPS");
  // ... start streaming
};
```

**3. Initial Device Setup** (lines ~480-494):

```typescript
useEffect(() => {
  if (!device) return;
  const configureDevice = async () => {
    await device.setSampleRate(2048000);
    await device.setFrequency(frequency);
    // ... other config
  };
  configureDevice();
}, [device]);
```

## Audio Buffer Sizing

**Formula**: AUDIO_BUFFER_SIZE = (target_latency_ms / 1000) \* sdr_sample_rate

**For 2.048 MSPS with ~64ms latency**:

```typescript
const AUDIO_BUFFER_SIZE = 131072; // ~64ms of RF data at 2.048 MSPS
```

**Previous (failed)**: 8192 samples = ~4ms at 2.048 MSPS (too small for stable demodulation)

**Trade-offs**:

- Larger buffer: More stable audio, higher latency
- Smaller buffer: Lower latency, more prone to dropouts
- Sweet spot: 64-128ms for FM broadcast reception

## Rate Selection Guidelines

### HackRF One Supported Rates

- Minimum: 1.75 MSPS
- Maximum: 28 MSPS
- Browser-optimized: **2.048 MSPS** or **4.096 MSPS**

### Use Case to Sample Rate Mapping

| Use Case          | Recommended Rate | Rationale                                |
| ----------------- | ---------------- | ---------------------------------------- |
| FM Broadcast      | 2.048 MSPS       | ±200 kHz bandwidth, efficient decimation |
| AM Broadcast      | 1.024 MSPS       | ±10 kHz bandwidth, very efficient        |
| P25 Trunking      | 2.048 MSPS       | 12.5 kHz channels, decimation-friendly   |
| Wideband Spectrum | 10-20 MSPS       | Visualization only (disable audio)       |
| Hardware Testing  | 20+ MSPS         | Verify USB throughput, no demodulation   |

### Browser-Specific Constraints

**Real-time audio demodulation viable**: <= 4 MSPS
**Visualization-only viable**: Up to device maximum (28 MSPS for HackRF)

## Debugging Checklist

When audio playback fails or visualizers show "Waiting for signal data":

1. **Verify sample rate configuration**:
   - Check console for "Sample rate set to X MSPS" message
   - Confirm rate matches AudioStreamProcessor initialization
   - Ensure rate set BEFORE `device.receive()` call

2. **Check buffer size alignment**:
   - AUDIO_BUFFER_SIZE should provide 50-100ms of RF data
   - Formula: (buffer_size / sample_rate) \* 1000 = latency_ms
   - For 2.048 MSPS: 131072 / 2048000 \* 1000 = 64ms ✅

3. **Verify decimation ratio**:
   - Ratio = sdr_sample_rate / audio_sample_rate
   - For 2.048 MSPS → 48 kHz: 2048000 / 48000 = ~42.67:1
   - Should be < 100:1 for browser real-time processing

4. **Console validation**:
   - Look for "Sample rate set to..." confirmation
   - Check for "transferIn ok, X bytes" USB streaming messages
   - Verify "Visualization update scheduled" messages

## Configuration Synchronization

**Critical**: All three locations must use same sample rate:

1. AudioStreamProcessor constructor argument
2. Device configuration in `beginDeviceStreaming`
3. Device configuration in initialization useEffect

**Anti-pattern**:

```typescript
// WRONG: Mismatched rates
audioProcessorRef.current = new AudioStreamProcessor(20000000);
await device.setSampleRate(2048000); // MISMATCH!
```

**Correct pattern**:

```typescript
// RIGHT: Single source of truth
const SDR_SAMPLE_RATE = 2048000;
audioProcessorRef.current = new AudioStreamProcessor(SDR_SAMPLE_RATE);
await device.setSampleRate(SDR_SAMPLE_RATE);
```

## Performance Indicators

**Healthy configuration** (2.048 MSPS):

- Console shows steady "transferIn ok" messages
- Visualizers update smoothly (30 FPS)
- Audio plays without dropouts
- CPU usage moderate (< 50% single core)

**Problematic configuration** (20 MSPS):

- Audio controls enabled but no sound
- Possible visualization lag
- High CPU usage
- Browser may become unresponsive

## Future Enhancements

**Dynamic rate selection**:

```typescript
function selectOptimalRate(signalType: SignalType): number {
  switch (signalType) {
    case "FM":
      return 2048000;
    case "AM":
      return 1024000;
    case "P25":
      return 2048000;
    default:
      return 2048000;
  }
}
```

**User-configurable rate** (advanced mode):

- Expose sample rate as UI control
- Warn when rate incompatible with audio playback
- Auto-disable audio for rates > 4 MSPS

## Related Files

- `src/pages/Visualizer.tsx`: Main configuration points
- `src/utils/audioStream.ts`: AudioStreamProcessor implementation
- `src/models/HackRFOne.ts`: Device setSampleRate implementation
- `src/models/HackRFOneAdapter.ts`: ISDRDevice interface wrapper
