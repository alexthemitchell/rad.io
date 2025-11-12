# AC-3 (Dolby Digital) Audio Decoder

This document describes the AC-3 audio decoder implementation for ATSC digital television broadcasts in rad.io.

## Overview

The AC-3 (Dolby Digital) decoder processes compressed audio streams from ATSC broadcasts, providing:

- Multi-channel audio (up to 5.1 channels)
- Channel downmixing to stereo
- Audio/video synchronization
- Dynamic range compression
- Multiple audio track support

## Architecture

### Processing Pipeline

```
Transport Stream → PES Parser → AC-3 Frame Parser → Audio Decoder → WebAudio API → Speakers
     (MPEG-TS)         ↓              ↓                   ↓              ↓
                    PTS/DTS      Sync Detection      Downmix to       Playback
                   Extraction      + Header          Stereo Audio      Queue
```

## Components

### AC3Decoder Class

**Location**: `src/decoders/AC3Decoder.ts`

The main decoder class that handles AC-3 bitstream parsing and audio processing.

**Key Responsibilities**:

- PES packet assembly and header parsing
- AC-3 frame synchronization and header extraction
- Audio sample generation (placeholder for full decoding)
- Channel downmixing (5.1 → stereo)
- Dynamic range compression
- PTS-based synchronization
- Audio buffer management

### Initialization

```typescript
import { AC3Decoder } from "./decoders/AC3Decoder";

const decoder = new AC3Decoder(
  (samples, sampleRate, channelCount, pts) => {
    // Handle decoded audio samples
    console.log(`Received ${samples.length} samples at ${sampleRate}Hz`);
  },
  (error) => {
    // Handle decoder errors
    console.error("Decoder error:", error);
  },
);

// Initialize decoder
decoder.initialize(48000, 2, 4096);
```

### Processing Transport Stream Data

```typescript
// Process audio payload from transport stream
decoder.processPayload(audioPayload);

// The decoder will:
// 1. Detect PES packet boundaries
// 2. Parse PES headers and extract PTS
// 3. Find AC-3 sync words (0x0B77)
// 4. Parse AC-3 frame headers
// 5. Output decoded audio samples via callback
```

## AC-3 Frame Structure

### Sync Word Detection

The decoder searches for the AC-3 sync word `0x0B77` to identify frame boundaries.

### Frame Header Parsing

Each AC-3 frame header contains:

- **syncword** (16 bits): Always 0x0B77
- **crc1** (16 bits): CRC for first 5/8 of frame
- **fscod** (2 bits): Sample rate code
  - 0 = 48 kHz
  - 1 = 44.1 kHz
  - 2 = 32 kHz
- **frmsizecod** (6 bits): Frame size code (0-37)
- **bsid** (5 bits): Bitstream identification
- **bsmod** (3 bits): Bitstream mode
- **acmod** (3 bits): Audio coding mode (channel configuration)
  - 0 = 1+1 (dual mono)
  - 1 = 1/0 (mono center)
  - 2 = 2/0 (stereo L, R)
  - 3 = 3/0 (L, C, R)
  - 4 = 2/1 (L, R, S)
  - 5 = 3/1 (L, C, R, S)
  - 6 = 2/2 (L, R, SL, SR)
  - 7 = 3/2 (L, C, R, SL, SR)
- **lfeon** (1 bit): LFE channel present

### Frame Size Calculation

Frame sizes are predetermined based on sample rate and bitrate:

```typescript
const frameSize = AC3_FRAME_SIZES[fscod][frmsizecod] * 2; // bytes
```

## Features

### 1. PES Packet Processing

The decoder handles MPEG-2 Program Elementary Stream (PES) packets:

```typescript
interface PESHeader {
  streamId: number;
  packetLength: number;
  pts?: number; // 33-bit timestamp at 90kHz
  dts?: number; // Decode timestamp
  headerDataLength: number;
}
```

**PTS Parsing**: Extracts 33-bit Presentation Time Stamps for A/V sync

```typescript
// PTS is encoded in 5 bytes with specific bit patterns
pts =
  ((data[9] & 0x0e) << 29) |
  ((data[10] & 0xff) << 22) |
  ((data[11] & 0xfe) << 14) |
  ((data[12] & 0xff) << 7) |
  ((data[13] & 0xfe) >> 1);
```

### 2. Channel Downmixing

Converts multi-channel audio to stereo using standard downmix matrices:

```typescript
// 5.1 to Stereo downmix formula
L_out = L + 0.707 * C + 0.707 * LS;
R_out = R + 0.707 * C + 0.707 * RS;
```

**Usage**:

```typescript
// Downmixing is automatic when processing frames
// Output is always stereo (2 channels)
```

### 3. Dynamic Range Compression

Reduces the dynamic range of audio to improve clarity at lower volumes:

```typescript
decoder.setDynamicRangeCompression(true, 2.0); // Enable with 2:1 ratio

// Compression algorithm
if (abs(sample) > threshold) {
  const excess = abs(sample) - threshold;
  const compressed = threshold + excess / ratio;
  output = sign(sample) * compressed;
}
```

**Parameters**:

- `enabled`: Boolean to enable/disable DRC
- `ratio`: Compression ratio (default 2.0 = 2:1)

### 4. Lip-Sync Correction

Adjust audio timing to synchronize with video:

```typescript
decoder.setAudioDelay(100); // Add 100ms delay
decoder.setAudioDelay(-50); // Advance audio by 50ms
```

The delay is applied to PTS values before queuing audio for playback.

### 5. Language Track Selection

Support for multiple audio tracks (e.g., English, Spanish, SAP):

```typescript
decoder.setLanguage("eng"); // Select English track
decoder.setLanguage("spa"); // Select Spanish track
decoder.setLanguage(null); // Clear selection
```

## State Management

### Decoder States

- **unconfigured**: Initial state, decoder not ready
- **configured**: Initialized and ready to process data
- **decoding**: Actively processing audio frames
- **flushing**: Outputting remaining buffered audio
- **error**: Error occurred, decoder stopped
- **closed**: Resources released, decoder stopped

### State Transitions

```
unconfigured → configured → decoding → flushing → configured
                   ↓            ↓           ↓
                 error      error       error
                   ↓            ↓           ↓
                closed ← configured ← flushing
```

## Performance Metrics

The decoder tracks performance metrics:

```typescript
interface AudioDecoderMetrics {
  framesDecoded: number; // Total frames processed
  framesDropped: number; // Frames dropped due to latency
  totalDecodeTime: number; // Cumulative decode time (ms)
  averageDecodeTime: number; // Average per frame (ms)
  currentBitrate: number; // Current bitrate (bps)
  lastUpdateTime: number; // Last metric update timestamp
  bufferHealth: number; // Buffer fullness (0-100%)
}

const metrics = decoder.getMetrics();
console.log(`Decoded ${metrics.framesDecoded} frames`);
console.log(`Average decode time: ${metrics.averageDecodeTime}ms`);
console.log(`Buffer health: ${metrics.bufferHealth}%`);
```

## Integration with ATSC Player

### Example Integration

```typescript
import { AC3Decoder } from "./decoders/AC3Decoder";
import { TransportStreamParser } from "./parsers/TransportStreamParser";

// Initialize transport stream parser
const tsParser = new TransportStreamParser();

// Initialize AC-3 decoder
const audioDecoder = new AC3Decoder(
  (samples, sampleRate, channelCount, pts) => {
    // Queue audio for playback
    audioQueue.push({ samples, sampleRate, channelCount, pts });
  },
  (error) => {
    console.error("AC-3 decoder error:", error);
  },
);

audioDecoder.initialize(48000, 2, 4096);

// Process transport stream
const packets = tsParser.parseStream(tsData);

// Get audio PIDs for current program
const audioPIDs = tsParser.getAudioPIDs(programNumber);

// Filter and process AC-3 audio packets
for (const packet of packets) {
  if (audioPIDs.includes(packet.pid)) {
    // Extract payload
    const payload = tsParser.extractPayload(packet);
    audioDecoder.processPayload(payload);
  }
}
```

## Limitations and Future Work

### Current Implementation

The current implementation provides a **parsing framework** for AC-3 streams with:

- ✅ Complete frame header parsing
- ✅ PTS extraction and synchronization
- ✅ Frame boundary detection
- ✅ Buffer management
- ⚠️ **Placeholder audio generation** (silent frames)

### Full AC-3 Decoding

Complete AC-3 decoding requires complex DSP operations:

1. **Bit Allocation**: Determine bits per mantissa
2. **Exponent Decoding**: Recover spectral envelope
3. **Mantissa Decoding**: Dequantize audio samples
4. **IMDCT**: Inverse Modified Discrete Cosine Transform
5. **Windowing**: Time-domain aliasing cancellation
6. **Overlap-Add**: Reconstruct time-domain samples

### Recommended Solutions

For production use, consider:

1. **WebAssembly AC-3 Decoder**

   - Port existing AC-3 decoder (e.g., FFmpeg's libavcodec)
   - Compile to WebAssembly for browser execution
   - Provides full decoding capability

2. **Server-Side Transcoding**

   - Transcode AC-3 to AAC/Opus on server
   - Use WebCodecs AudioDecoder for supported formats
   - Reduces client-side complexity

3. **WebCodecs API** (if browser supports AC-3)

   ```typescript
   const audioDecoder = new AudioDecoder({
     output: (audioData) => {
       /* handle decoded samples */
     },
     error: (error) => {
       /* handle error */
     },
   });
   audioDecoder.configure({
     codec: "ac-3",
     sampleRate: 48000,
     numberOfChannels: 6,
   });
   ```

## API Reference

### Constructor

```typescript
new AC3Decoder(
  onAudioOutput: (samples: Float32Array, sampleRate: number, channelCount: number, pts?: number) => void,
  onError: (error: Error) => void
)
```

### Methods

#### `initialize(sampleRate?, channelCount?, bufferSize?): void`

Initialize the decoder with audio configuration.

**Parameters**:

- `sampleRate` (optional): Output sample rate (default: 48000 Hz)
- `channelCount` (optional): Output channels (default: 2)
- `bufferSize` (optional): Audio buffer size (default: 4096)

#### `processPayload(payload: Uint8Array): void`

Process transport stream payload containing AC-3 data.

#### `setDynamicRangeCompression(enabled: boolean, ratio?: number): void`

Configure dynamic range compression.

#### `setAudioDelay(delayMs: number): void`

Set audio delay for lip-sync correction (in milliseconds).

#### `setLanguage(language: string | null): void`

Select audio language track.

#### `flush(): void`

Flush pending audio buffers.

#### `reset(): void`

Reset decoder state and clear buffers.

#### `close(): void`

Release resources and stop decoder.

#### `getState(): DecoderState`

Get current decoder state.

#### `getMetrics(): AudioDecoderMetrics`

Get performance metrics.

#### `getConfig(): AudioConfig | null`

Get current audio configuration.

## Testing

### Test Coverage

The decoder includes comprehensive tests:

- ✅ 34 unit tests covering all major functionality
- ✅ PES packet parsing and PTS extraction
- ✅ AC-3 frame synchronization
- ✅ Partial frame handling across packets
- ✅ Channel downmixing
- ✅ Dynamic range compression
- ✅ Lip-sync correction
- ✅ State management
- ✅ Error handling and recovery
- ✅ Resource cleanup

### Running Tests

```bash
npm test -- src/decoders/__tests__/AC3Decoder.test.ts
```

## References

- **ATSC A/52**: AC-3 Audio System Standard
- **ATSC A/53**: ATSC Digital Television Standard
- **ISO 13818-1**: MPEG-2 Systems (Transport Stream)
- **Web Audio API**: W3C Specification

## See Also

- [ATSCVideoDecoder](./ATSCVideoDecoder.md) - Video decoder implementation
- [TransportStreamParser](./TransportStreamParser.md) - MPEG-2 TS parser
- [ATSC Player Implementation](../atsc-player-implementation.md) - Complete player
