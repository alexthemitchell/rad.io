# Audio Playback Debugging Guide

## Quick Reference: Audio Playback Architecture

**Data flow**: SDR IQ samples → Buffering → Demodulation → Decimation → Web Audio API playback

**Key components**:
- `src/pages/Visualizer.tsx`: Audio state management, buffering, playback control
- `src/utils/audioStream.ts`: AudioStreamProcessor (demodulation + decimation)
- `src/components/AudioControls.tsx`: UI controls

## Common Audio Playback Issues

### Issue 1: Audio Controls Enabled but No Sound

**Symptoms**:
- "Play Audio" button clickable
- Status shows "🎵 Playing FM audio"
- No audible output
- No errors in console

**Root Causes**:
1. **Sample rate mismatch** (MOST COMMON):
   - AudioStreamProcessor initialized with wrong sample rate
   - Device configured with different rate
   - Decimation ratio becomes invalid

2. **Buffer size too small**:
   - Audio chunks too short for stable demodulation
   - Causes pops, clicks, or silence

3. **AudioContext issues**:
   - Context created but not properly connected
   - GainNode not connected to destination
   - Volume set to 0 or muted

**Diagnostic Steps**:

```typescript
// 1. Check sample rate synchronization
console.log("AudioProcessor SDR rate:", audioProcessorRef.current.sdrSampleRate);
console.log("Device sample rate:", await device.getSampleRate());
// These MUST match!

// 2. Verify buffer accumulation
console.log("Audio buffer size:", audioSampleBufferRef.current.length);
console.log("Target buffer size:", AUDIO_BUFFER_SIZE);
// Buffer should reach target size before demodulation

// 3. Check AudioContext state
console.log("AudioContext state:", audioContextRef.current?.state);
console.log("GainNode value:", gainNodeRef.current?.gain.value);
// State should be "running", gain > 0 if not muted

// 4. Verify demodulation output
const result = await audioProcessorRef.current.extractAudio(...);
console.log("Audio samples extracted:", result.audioData.length);
console.log("Sample range:", [
  Math.min(...result.audioData),
  Math.max(...result.audioData)
]);
// Should have samples, range should vary (not all zeros)
```

**Solutions**:

**Sample rate mismatch**:
```typescript
// WRONG: Mismatched rates
audioProcessorRef.current = new AudioStreamProcessor(20000000);
await device.setSampleRate(2048000);

// RIGHT: Synchronized rates
const SDR_SAMPLE_RATE = 2048000;
audioProcessorRef.current = new AudioStreamProcessor(SDR_SAMPLE_RATE);
await device.setSampleRate(SDR_SAMPLE_RATE);
```

**Buffer size adjustment**:
```typescript
// Too small (unstable):
const AUDIO_BUFFER_SIZE = 8192; // ~4ms at 2.048 MSPS

// Optimal (stable):
const AUDIO_BUFFER_SIZE = 131072; // ~64ms at 2.048 MSPS
```

### Issue 2: Audio Playback Choppy or Distorted

**Symptoms**:
- Audio plays but with pops, clicks, or dropouts
- Sporadic silence gaps
- Distorted sound quality

**Root Causes**:
1. **Insufficient buffering** (buffer too small)
2. **CPU overload** (sample rate too high)
3. **Signal quality** (weak RF signal)
4. **Incorrect demodulation type** (AM vs FM vs P25)

**Solutions**:

**Increase buffer size**:
```typescript
// Provide more RF data per audio chunk
const AUDIO_BUFFER_SIZE = 131072; // 64ms
// or
const AUDIO_BUFFER_SIZE = 262144; // 128ms (higher latency, more stable)
```

**Reduce sample rate** (if CPU-bound):
```typescript
// From 20 MSPS (too high for browser)
await device.setSampleRate(20000000);

// To 2.048 MSPS (browser-optimized)
await device.setSampleRate(2048000);
```

**Verify signal type matches demodulation**:
```typescript
// Ensure signal type selector matches actual signal
const demodType = getDemodType(signalType);
// FM → DemodulationType.FM
// AM → DemodulationType.AM
// P25 → DemodulationType.FM (C4FM)
```

### Issue 3: Audio Doesn't Stop When Clicking Pause

**Symptoms**:
- "Pause Audio" button clicked
- Status shows "Audio paused"
- Sound continues playing

**Root Cause**:
- AudioBufferSourceNode nodes already scheduled
- Web Audio API doesn't support stopping nodes retroactively

**Solution** (current implementation is correct):
```typescript
const handleToggleAudio = useCallback(() => {
  setIsAudioPlaying((prev) => {
    const newState = !prev;
    if (!newState) {
      // Clear buffer and reset processor on pause
      audioSampleBufferRef.current = [];
      audioProcessorRef.current?.reset();
    }
    return newState;
  });
}, []);

// In processAudioChunk: Early exit if not playing
if (!isAudioPlaying || !audioProcessorRef.current) {
  return; // Won't schedule new audio nodes
}
```

**Note**: Already-scheduled nodes will finish playing (latency = buffer size in ms)

### Issue 4: Audio Controls Never Become Enabled

**Symptoms**:
- Device connected and streaming
- Visualizations updating
- Audio controls remain disabled (grayed out)

**Root Cause**:
- `isAvailable` prop to AudioControls not true
- Usually means `listening` state not set to true

**Diagnostic**:
```typescript
// In Visualizer.tsx
console.log("Audio controls available:", {
  device: !!device,
  listening: listening,
  isAvailable: !!device && listening
});
```

**Solution**:
- Verify `setListening(true)` called when streaming starts
- Check `beginDeviceStreaming` sets listening state correctly:

```typescript
const beginDeviceStreaming = async (device: ISDRDevice) => {
  setListening(true); // MUST be set!
  // ... configure and start streaming
};
```

## Configuration Checklist

When implementing or debugging audio playback:

### 1. Sample Rate Configuration (CRITICAL)

**All three must match**:
```typescript
// 1. AudioStreamProcessor initialization
audioProcessorRef.current = new AudioStreamProcessor(2048000);

// 2. Device configuration before streaming
await device.setSampleRate(2048000);

// 3. Device initialization effect
useEffect(() => {
  device?.setSampleRate(2048000);
}, [device]);
```

### 2. Buffer Size Configuration

**Formula**: `buffer_size = (latency_ms / 1000) * sdr_sample_rate`

**Recommendations**:
- AM broadcast: 32768-65536 samples (~16-32ms at 2 MSPS)
- FM broadcast: 65536-131072 samples (~32-64ms at 2 MSPS)
- P25 digital: 131072-262144 samples (~64-128ms at 2 MSPS)

### 3. Audio Processing Options

**extractAudio parameters**:
```typescript
const result = await audioProcessorRef.current.extractAudio(
  samplesToProcess,
  demodType,
  {
    sampleRate: 48000,        // Output sample rate (CD quality)
    channels: 1,              // Mono (SDR is mono)
    enableDeEmphasis: true,   // FM only (75μs de-emphasis)
  }
);
```

**De-emphasis**:
- Enable for FM: `enableDeEmphasis: signalType === "FM"`
- Disable for AM/P25: `enableDeEmphasis: false`

### 4. Web Audio API Setup

**Critical connections**:
```typescript
// Initialize audio context and gain node
audioContextRef.current = new AudioContext();
gainNodeRef.current = audioContextRef.current.createGain();
gainNodeRef.current.connect(audioContextRef.current.destination);

// Create and connect source node
const source = audioContext.createBufferSource();
source.buffer = result.audioBuffer;
source.connect(gainNode); // NOT directly to destination!
source.start();
```

**WRONG** (common mistake):
```typescript
source.connect(audioContext.destination); // Bypasses volume control!
```

### 5. State Management

**Required state variables**:
```typescript
const [isAudioPlaying, setIsAudioPlaying] = useState(false);
const [audioVolume, setAudioVolume] = useState(0.5);
const [isAudioMuted, setIsAudioMuted] = useState(false);
const [listening, setListening] = useState(false);
```

**Critical refs** (not state, for high-frequency updates):
```typescript
const audioContextRef = useRef<AudioContext>();
const audioProcessorRef = useRef<AudioStreamProcessor>();
const gainNodeRef = useRef<GainNode>();
const audioSampleBufferRef = useRef<Sample[]>([]);
```

## Testing Audio Playback

### Unit Tests

**Test file**: `src/components/__tests__/AudioControls.test.tsx`

**Key test scenarios**:
- Play/pause toggle functionality
- Volume control updates
- Mute/unmute behavior
- Disabled state when device unavailable
- ARIA attributes and accessibility

### Integration Testing (Browser Automation)

**Manual steps**:
1. Connect SDR device (physical hardware required)
2. Navigate to visualizer
3. Pair device in browser WebUSB dialog
4. Click "Start Reception"
5. Wait for streaming to start (console: "transferIn ok")
6. Click "Play Audio"
7. Verify status shows "🎵 Playing FM audio"
8. **Listen for audible sound** (automation can't verify this!)

**Automation verification** (partial):
```typescript
// Can verify state transitions
await browser_click({ element: "Play Audio button", ref: "..." });
await browser_wait_for({ text: "⏸ Pause Audio" });
await browser_wait_for({ text: "🎵 Playing FM audio" });

// Cannot verify audible sound without external hardware
```

### Manual Audio Quality Testing

**Equipment needed**:
- FM/AM radio signal source (antenna or signal generator)
- SDR device (HackRF One)
- Computer with audio output

**Test procedure**:
1. Tune to known station (e.g., 88.5 FM)
2. Verify audio is clear and understandable
3. Adjust volume (should work smoothly)
4. Test mute/unmute
5. Switch signal types (FM → AM)
6. Verify audio changes appropriately

**Quality indicators**:
- Clear speech/music (no excessive noise)
- No pops, clicks, or dropouts
- Smooth volume control
- Proper stereo separation (if implemented)
- Appropriate de-emphasis (FM sounds natural)

## Performance Monitoring

**Audio-specific metrics**:
```typescript
// Buffer fill rate
const bufferFillRate = audioSampleBufferRef.current.length / AUDIO_BUFFER_SIZE;
console.log("Buffer fill:", (bufferFillRate * 100).toFixed(1) + "%");

// Processing latency
const startTime = performance.now();
const result = await audioProcessorRef.current.extractAudio(...);
const latency = performance.now() - startTime;
console.log("Demod latency:", latency.toFixed(2) + "ms");

// Decimation ratio
const decimationRatio = sdrSampleRate / 48000;
console.log("Decimation ratio:", decimationRatio.toFixed(2) + ":1");
```

**Healthy benchmarks** (2.048 MSPS, 131K buffer):
- Buffer fill: 100% before extraction
- Demod latency: < 50ms
- Decimation ratio: ~42:1
- Audio chunk duration: ~64ms

## Common Pitfalls

❌ **DON'T**:
- Initialize AudioStreamProcessor with placeholder rate
- Set device sample rate after calling `receive()`
- Use different rates in different configuration locations
- Make buffer size too small (< 32K samples)
- Connect source directly to AudioContext.destination (bypasses gain)
- Assume audio works without manual listening test

✅ **DO**:
- Synchronize sample rates across all configuration points
- Set sample rate BEFORE starting streaming
- Use buffer size that provides 50-100ms of RF data
- Connect source → GainNode → destination
- Test with real RF signals, not just synthetic data
- Provide clear user feedback on audio state
- Handle audio errors gracefully

## Debugging Tools

**Console logging**:
```typescript
// Add to processAudioChunk
console.debug("Audio processing:", {
  bufferSize: audioSampleBufferRef.current.length,
  isPlaying: isAudioPlaying,
  demodType: getDemodType(signalType),
  targetSampleRate: 48000
});

// Add to playAudioBuffer
console.debug("Playing audio buffer:", {
  samples: result.audioData.length,
  duration: result.audioData.length / 48000,
  range: [
    Math.min(...result.audioData),
    Math.max(...result.audioData)
  ]
});
```

**Browser DevTools**:
- Console: Check for Web Audio API errors
- Performance: Profile audio processing CPU usage
- Memory: Check for AudioContext leaks

**External verification**:
- Oscilloscope: Inspect audio output signal
- Spectrum analyzer: Verify demodulated audio spectrum
- Recording: Capture and analyze audio quality

## Related Documentation

- `src/utils/AUDIO_STREAM_API.md`: AudioStreamProcessor API details
- Memory: `AUDIO_PLAYBACK_IMPLEMENTATION`: High-level architecture
- Memory: `SDR_SAMPLE_RATE_CONFIGURATION`: Sample rate selection guide
- Memory: `WEBUSB_STREAMING_DEBUG_GUIDE`: Device streaming issues
