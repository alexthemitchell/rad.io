# Audio Playback Implementation

## Overview

Audio playback has been fully integrated into the rad.io visualizer, allowing users to hear real-time demodulated audio from FM, AM, and P25 signals. The implementation uses the Web Audio API for low-latency playback and supports volume control, mute functionality, and multiple signal types.

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

## Key Features

### 1. Real-Time Audio Processing

- **Buffer Size**: 8192 samples per chunk for smooth playback
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

### Audio Initialization

```typescript
// Initialize audio context and processor (Visualizer.tsx)
useEffect(() => {
  const initialVolume = audioVolume;
  audioContextRef.current = new AudioContext();
  gainNodeRef.current = audioContextRef.current.createGain();
  gainNodeRef.current.connect(audioContextRef.current.destination);
  gainNodeRef.current.gain.value = initialVolume;

  audioProcessorRef.current = new AudioStreamProcessor(20000000);

  return (): void => {
    audioProcessorRef.current?.cleanup();
    audioContextRef.current?.close();
  };
}, []);
```

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
      const source = audioContext.createBufferSource();
      source.buffer = result.audioBuffer;
      source.connect(gainNode);
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

### Styling

Custom CSS classes in `src/styles/main.css`:

```css
.audio-controls
.audio-controls-row
.btn-audio
.btn-mute
.volume-control
.volume-slider
.volume-display
.audio-status
.audio-status-active
.audio-status-inactive
```

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

- **Chunk Size**: 8192 samples (optimal for 48kHz playback)
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

## Future Enhancements

### Potential Improvements

1. **Audio Recording**: Export demodulated audio to WAV/MP3
2. **Audio Analysis**: Real-time spectrum analyzer for audio output
3. **Stereo Output**: Stereo separation for stereo FM broadcasts
4. **Audio Effects**: Equalizer, noise reduction, AGC
5. **Speech Recognition**: Integration with speech recognition API
6. **Talkgroup Audio**: Per-talkgroup audio routing for P25

### API Extensions

```typescript
// Future API additions
interface AudioControlsProps {
  // ... existing props ...
  onRecordStart?: () => void;
  onRecordStop?: () => void;
  audioEffects?: AudioEffect[];
  stereoMode?: boolean;
}
```

## Troubleshooting

### Common Issues

**Issue**: No audio output
- Check browser supports Web Audio API
- Verify volume is not at 0 or muted
- Ensure device is connected and listening
- Check browser's audio permissions

**Issue**: Distorted audio
- Reduce volume if clipping
- Check signal strength (weak signals cause distortion)
- Verify correct demodulation type for signal

**Issue**: Audio lag/latency
- Audio buffer size (8192) optimized for balance
- Browser may introduce additional latency
- Check system audio buffer settings

### Debug Logging

```typescript
// Enable debug logging
console.log("Audio State:", {
  isPlaying: isAudioPlaying,
  volume: audioVolume,
  muted: isAudioMuted,
  bufferSize: audioSampleBufferRef.current.length,
});
```

## References

### Related Files

- `src/pages/Visualizer.tsx` - Main integration
- `src/components/AudioControls.tsx` - UI component
- `src/utils/audioStream.ts` - Audio processing
- `src/utils/AUDIO_STREAM_API.md` - API documentation
- `src/examples/audioStreamIntegration.tsx` - Example usage

### Dependencies

- Web Audio API (built-in browser API)
- React hooks (useState, useEffect, useCallback, useRef)
- AudioStreamProcessor class
- IQSample type from SDRDevice

## Best Practices

### When to Use Audio Playback

✅ **Good Use Cases:**
- Listening to FM/AM radio broadcasts
- Monitoring P25 talkgroups
- Voice communication signals
- Audio signal analysis

❌ **Not Recommended For:**
- Pure data signals (no audio content)
- Very weak signals (poor SNR)
- High-speed data modes
- Encrypted transmissions

### User Experience

- Start with moderate volume (50%)
- Provide clear visual feedback
- Don't auto-play audio (let user control)
- Handle errors gracefully
- Announce state changes to screen readers

---

## Summary

Audio playback is now fully integrated into rad.io, providing a complete SDR experience with both visualization and audio output. The implementation is efficient, accessible, and extensible for future enhancements.
