# AC-3 Audio Decoder Implementation

## Overview

Implemented complete AC-3 (Dolby Digital) audio decoder for ATSC broadcasts in `src/decoders/AC3Decoder.ts`. Provides AC-3 frame parsing, PTS synchronization, and audio processing pipeline.

## Key Components

### Core Decoder (`AC3Decoder` class)

- **Frame Parsing**: Detects sync word (0x0B77), parses headers with sample rate/bitrate/channels
- **PES Assembly**: Handles MPEG-2 PES packets with PTS/DTS extraction
- **Audio Queue**: Buffer management with PTS-based synchronization
- **Channel Downmix**: 5.1 → stereo downmix support
- **DRC**: Dynamic range compression with configurable ratio
- **Lip-sync**: Audio delay adjustment for A/V synchronization

### AC-3 Frame Header Fields

- `fscod`: Sample rate (0=48kHz, 1=44.1kHz, 2=32kHz)
- `frmsizecod`: Frame size code (0-37)
- `acmod`: Channel configuration (0-7, maps to 1-6 channels)
- `lfeon`: LFE channel present flag
- Frame size lookup: `AC3_FRAME_SIZES[fscod][frmsizecod] * 2` bytes

## Usage Pattern

```typescript
const decoder = new AC3Decoder(
  (samples, sampleRate, channelCount, pts) => {
    /* output */
  },
  (error) => {
    /* handle error */
  },
);
decoder.initialize(48000, 2, 4096);
decoder.processPayload(tsPayload); // Process TS packets
decoder.setDynamicRangeCompression(true, 2.0);
decoder.setAudioDelay(100); // 100ms delay for lip-sync
```

## Integration with ATSC

Works with `TransportStreamParser` to process complete broadcast pipeline:

1. Parser identifies AC-3 audio PIDs (StreamType.AC3_AUDIO = 0x81)
2. Demultiplex audio packets by PID
3. Decoder processes payloads → outputs audio samples
4. WebAudio API handles playback

## Current Implementation

**WebCodecs Native Decoding**: The implementation uses WebCodecs AudioDecoder for full AC-3 decoding when supported by the browser:

- ✅ Complete AC-3 frame parsing and validation
- ✅ Native decoding via WebCodecs AudioDecoder (when available)
- ✅ ITU-R BS.775 compliant multi-channel downmixing
- ✅ Automatic fallback to frame parsing when WebCodecs unsupported
- ⚠️ Fallback mode generates silent placeholder audio

**Production Ready**: No additional dependencies required for browsers with WebCodecs AC-3 support (Chrome, Edge, modern Safari).

**Alternative for Unsupported Browsers**:

1. WebAssembly AC-3 decoder (port FFmpeg libavcodec)
2. Server-side transcoding to AAC/Opus

## Testing

- Comprehensive unit tests covering all functionality
- Tests include PES parsing, frame sync, partial frames, downmix, DRC, state management, WebCodecs integration
- All tests passing with proper error handling

## Code Quality

- TypeScript strict mode, no `any` types
- No unsafe enum comparisons (use numeric literals)
- Proper error handling with try-catch in processPayload
- Resource cleanup on close()

## Files

- `src/decoders/AC3Decoder.ts` - Main implementation
- `src/decoders/__tests__/AC3Decoder.test.ts` - Tests
- `docs/reference/ac3-decoder.md` - Complete documentation
- `src/decoders/index.ts` - Exports

## See Also

- ATSCVideoDecoder pattern for consistency
- TransportStreamParser for integration
- ATSC A/52 specification for AC-3 details
