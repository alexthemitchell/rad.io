# Audio Playback Implementation

## Overview

Audio playback is fully integrated into the rad.io visualizer, allowing users to hear real-time demodulated audio from FM, AM, and P25 signals. The implementation uses the Web Audio API for low-latency playback and supports volume control, mute functionality, and multiple signal types.

**CRITICAL**: Audio playback requires proper SDR sample rate configuration. See "Sample Rate Configuration" section below.

## Architecture

### Component Structure

```
Visualizer (src/pages/Visualizer.tsx)
├── Audio State Management
│   ├── isAudioPlaying: boolean
│   ├── audioVolume: number (0-1)
│   └── isAudioMuted: boolean
├── Audio Processing Refs
│   ├── audioContextRef: AudioContext
│   ├── audioProcessorRef: AudioStreamProcessor
│   ├── gainNodeRef: GainNode
│   └── audioSampleBufferRef: Sample[]
└── AudioControls Component
    └── Play/Pause, Volume, Mute controls
```

### Data Flow

```
IQ Samples from SDR Device
    ↓
handleSampleChunk()
    ↓
processAudioChunk() [async]
    ↓
AudioStreamProcessor.extractAudio()
    ├── Demodulation (FM/AM/P25)
    ├── De-emphasis filtering (FM)
    └── Decimation to 48kHz
    ↓
playAudioBuffer()
    ├── AudioBufferSourceNode creation
    ├── Connect to GainNode (volume control)
    └── Start playback
```

## Sample Rate Configuration (CRITICAL)

### The 20 MSPS Problem

**ISSUE**: Using 20 MSPS (20,000,000 samples/second) causes audio playback failure:
- No audible sound despite controls showing "Playing FM audio"
- Excessive CPU load for real-time browser demodulation
- Decimation ratio ~417:1 (20,000,000 / 48,000) impractical for JavaScript

### Solution: Browser-Optimized Rate

**Use 2.048 MSPS** (2,048,000 samples/second) for browser applications:
- Decimation ratio ~42:1 (practical for real-time)
- CPU-efficient processing
- Maintains adequate bandwidth for FM broadcasts (±200 kHz)
- Proper alignment with audio processing pipeline

### Implementation Locations (src/pages/Visualizer.tsx)

**ALL THREE locations must use same rate**:

**1. Audio Processor Initialization** (lines ~70-84):
```typescript
useEffect(() => {
  audioContextRef.current = new AudioContext();
  gainNodeRef.current = audioContextRef.current.createGain();
  gainNodeRef.current.connect(audioContextRef.current.destination);
  gainNodeRef.current.gain.value = audioVolume;

  // CRITICAL: Match device sample rate
  audioProcessorRef.current = new AudioStreamProcessor(2048000); // NOT 20000000

  return (): void => {
    audioProcessorRef.current?.cleanup();
    audioContextRef.current?.close();
  };
}, []);
```

**2. Device Streaming Configuration** (lines ~319-365):
```typescript
const beginDeviceStreaming = async (device: ISDRDevice) => {
  setActiveDevice(device);
  setListening(true);

  // CRITICAL: Set sample rate BEFORE calling receive()
  await activeDevice.setSampleRate(2048000); // NOT 20000000
  console.warn("Sample rate set to 2.048 MSPS");

  // Start receiving data
  await activeDevice.receive(handleSampleChunk);
};
```

**3. Initial Device Configuration** (lines ~480-494):
```typescript
useEffect(() => {
  if (!device) return;

  const configureDevice = async () => {
    try {
      await device.setSampleRate(2048000); // NOT 20000000
      await device.setFrequency(frequency);
      await device.setBandwidth(bandwidth);
      await device.setAmpEnable(ampEnabled);
    } catch (error) {
      console.error("Device configuration error:", error);
    }
  };

  configureDevice();
}, [device, frequency, bandwidth, ampEnabled]);
```

### Buffer Size Configuration

**AUDIO_BUFFER_SIZE** must provide adequate latency for stable demodulation:

```typescript
// Too small (causes instability):
const AUDIO_BUFFER_SIZE = 8192; // ~4ms at 2.048 MSPS

// Optimal (stable audio):
const AUDIO_BUFFER_SIZE = 131072; // ~64ms at 2.048 MSPS
```

**Formula**: `buffer_size = (target_latency_ms / 1000) * sdr_sample_rate`

**Trade-offs**:
- Larger buffer: More stable audio, higher latency
- Smaller buffer: Lower latency, more prone to dropouts
- Sweet spot: 64-128ms for FM broadcast reception

## Key Features

### 1. Real-Time Audio Processing

- **Buffer Size**: 131,072 samples (~64ms) for smooth playback
- **Sample Rate**: 48kHz output (CD quality)
- **Channels**: Mono output (1 channel)
- **Latency**: Low-latency processing with chunked buffers

### 2. Signal Type Support

- **FM**: FM demodulation with 75μs de-emphasis filtering
- **AM**: AM envelope detection with DC removal
- **P25**: C4FM demodulation (uses FM demod for symbol extraction)

### 3. Audio Controls

- **Play/Pause**: Toggle audio playback independently of visualization
- **Volume Control**: 0-100% with slider (0.05 step)
- **Mute Button**: Quick mute/unmute without changing volume
- **Status Display**: Visual feedback on playback state

### 4. Accessibility

- **ARIA Labels**: All controls have proper labels
- **Live Region**: Status updates announced to screen readers
- **Keyboard Navigation**: Full keyboard support
- **Disabled States**: Clear visual feedback when unavailable

## Implementation Details

### Volume Management

```typescript
// Update volume dynamically
useEffect(() => {
  if (gainNodeRef.current) {
    gainNodeRef.current.gain.value = isAudioMuted ? 0 : audioVolume;
  }
}, [audioVolume, isAudioMuted]);
```

### Signal Type to Demodulation Mapping

```typescript
const getDemodType = useCallback((type: SignalType): DemodulationType => {
  switch (type) {
    case "FM":
      return DemodulationType.FM;
    case "AM":
      return DemodulationType.AM;
    case "P25":
      return DemodulationType.FM; // P25 uses C4FM
    default:
      return DemodulationType.FM;
  }
}, []);
```

### Audio Processing Pipeline

```typescript
const processAudioChunk = useCallback(
  async (chunk: Sample[]): Promise<void> => {
    if (!isAudioPlaying || !audioProcessorRef.current) {
      return;
    }

    // Accumulate samples
    audioSampleBufferRef.current = audioSampleBufferRef.current.concat(chunk);

    // Process when buffer is full
    if (audioSampleBufferRef.current.length >= AUDIO_BUFFER_SIZE) {
      const samplesToProcess = audioSampleBufferRef.current.slice(
        0,
        AUDIO_BUFFER_SIZE,
      );
      audioSampleBufferRef.current = audioSampleBufferRef.current.slice(
        AUDIO_BUFFER_SIZE,
      );

      const demodType = getDemodType(signalType);
      const result = await audioProcessorRef.current.extractAudio(
        samplesToProcess,
        demodType,
        {
          sampleRate: 48000,
          channels: 1,
          enableDeEmphasis: signalType === "FM",
        },
      );

      playAudioBuffer(result);
    }
  },
  [isAudioPlaying, signalType, getDemodType, playAudioBuffer, AUDIO_BUFFER_SIZE],
);
```

### Playback Function

```typescript
const playAudioBuffer = useCallback(
  (result: AudioStreamResult) => {
    const audioContext = audioContextRef.current;
    const gainNode = gainNodeRef.current;

    if (!audioContext || !gainNode || !isAudioPlaying) {
      return;
    }

    try {
      // CRITICAL: Create buffer in same AudioContext for playback
      const source = audioContext.createBufferSource();
      source.buffer = result.audioBuffer;
      source.connect(gainNode); // NOT directly to destination!
      source.start();
    } catch (error) {
      console.error("Audio playback error:", error);
    }
  },
  [isAudioPlaying],
);
```

## AudioControls Component

### Location
`src/components/AudioControls.tsx`

### Props Interface

```typescript
export interface AudioControlsProps {
  isPlaying: boolean;
  volume: number; // 0-1
  isMuted: boolean;
  signalType: SignalType;
  isAvailable: boolean; // Device connected and listening
  onTogglePlay: () => void;
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
}
```

### UI Elements

1. **Play/Pause Button**
   - Shows ▶ when paused
   - Shows ⏸ when playing
   - Disabled when device not available

2. **Mute Button**
   - Shows 🔊 when unmuted
   - Shows 🔇 when muted
   - Disabled when device not available

3. **Volume Slider**
   - Range: 0-1 with 0.05 steps
   - Displays percentage (0-100%)
   - Disabled when device not available
   - ARIA attributes for screen readers

4. **Status Display**
   - Shows "🎵 Playing [TYPE] audio" when active
   - Shows "Audio paused" when inactive
   - Live region for screen reader announcements

## Testing

### Test File
`src/components/__tests__/AudioControls.test.tsx`

### Test Coverage

✅ **23 passing tests** covering:

1. **Basic Rendering**: Default props, playing/paused states
2. **Volume Control**: Display, muted display, slider interaction
3. **Play/Pause Button**: Click handlers, disabled states
4. **Mute Button**: Icon display, click handlers, disabled states
5. **Accessibility**: ARIA labels, live regions, roles
6. **Signal Type Integration**: FM, AM, P25 display
7. **Edge Cases**: Min/max volume, unavailable device

### Running Tests

```bash
npm test -- src/components/__tests__/AudioControls.test.tsx
```

## Usage

### In Visualizer Component

```tsx
<Card title="Audio Playback" subtitle="Real-time audio demodulation and output">
  <AudioControls
    isPlaying={isAudioPlaying}
    volume={audioVolume}
    isMuted={isAudioMuted}
    signalType={signalType}
    isAvailable={!!device && listening}
    onTogglePlay={handleToggleAudio}
    onVolumeChange={handleVolumeChange}
    onToggleMute={handleToggleMute}
  />
</Card>
```

### Control Handlers

```typescript
const handleToggleAudio = useCallback(() => {
  setIsAudioPlaying((prev) => {
    const newState = !prev;
    if (!newState) {
      audioSampleBufferRef.current = [];
      audioProcessorRef.current?.reset();
    }
    setLiveRegionMessage(
      newState ? "Audio playback started" : "Audio playback stopped",
    );
    return newState;
  });
}, []);

const handleVolumeChange = useCallback((volume: number) => {
  setAudioVolume(volume);
}, []);

const handleToggleMute = useCallback(() => {
  setIsAudioMuted((prev) => {
    const newState = !prev;
    setLiveRegionMessage(newState ? "Audio muted" : "Audio unmuted");
    return newState;
  });
}, []);
```

## Performance Considerations

### Buffer Management

- **Chunk Size**: 131,072 samples (optimal for 48kHz playback at 2.048 MSPS)
- **Buffer Clearing**: Audio buffer cleared when playback stops
- **Memory Cleanup**: AudioContext and processor cleaned up on unmount

### Processing Efficiency

- **Asynchronous Processing**: Audio processing doesn't block visualization
- **Conditional Processing**: Only processes when `isAudioPlaying` is true
- **Error Handling**: Graceful error handling for audio processing failures

### Web Audio API Optimizations

- **GainNode**: Single gain node for all audio sources
- **Direct Connection**: Source → GainNode → Destination (minimal graph)
- **Source Lifecycle**: AudioBufferSourceNode automatically garbage collected

## Troubleshooting

### Common Issues

**Issue**: No audio output despite "Playing FM audio" status
- **Root Cause**: Sample rate mismatch (20 MSPS used instead of 2.048 MSPS)
- **Solution**: Ensure all three configuration locations use 2,048,000 Hz
- **Verification**: Check console for "Sample rate set to 2.048 MSPS"

**Issue**: Audio choppy or distorted
- **Root Cause**: Buffer size too small or CPU overload
- **Solution**: Increase AUDIO_BUFFER_SIZE to 131,072 or higher
- **Verification**: Monitor buffer fill rate in console

**Issue**: Audio controls never enabled
- **Root Cause**: `listening` state not set to true
- **Solution**: Verify `setListening(true)` called in `beginDeviceStreaming`

### Debug Logging

```typescript
// Enable debug logging
console.log("Audio State:", {
  isPlaying: isAudioPlaying,
  volume: audioVolume,
  muted: isAudioMuted,
  bufferSize: audioSampleBufferRef.current.length,
  sdrSampleRate: audioProcessorRef.current?.sdrSampleRate,
});
```

## Integration with Existing Features

### Compatible With

- ✅ **All Signal Types**: FM, AM, P25
- ✅ **All Visualizations**: IQ, Waveform, Spectrogram
- ✅ **Device Controls**: Frequency, bandwidth, gain
- ✅ **Performance Monitoring**: Audio processing tracked
- ✅ **Accessibility Features**: Full screen reader support

### Independent Operation

- Audio can be toggled without stopping visualization
- Visualization can run without audio playback
- Volume/mute changes don't affect device configuration
- Audio state persists across frequency changes

## Related Documentation

- `src/utils/AUDIO_STREAM_API.md` - AudioStreamProcessor API details
- Memory: `SDR_SAMPLE_RATE_CONFIGURATION` - Sample rate selection guide
- Memory: `AUDIO_PLAYBACK_DEBUGGING` - Comprehensive debugging guide
- Memory: `WEBUSB_STREAMING_DEBUG_GUIDE` - Device streaming issues

## Summary

Audio playback is fully integrated into rad.io with proper sample rate configuration (2.048 MSPS) and buffering (131K samples). The implementation is efficient, accessible, and provides clear user feedback. Critical for success: synchronize sample rates across all configuration points and use adequate buffer sizes for stable demodulation.
