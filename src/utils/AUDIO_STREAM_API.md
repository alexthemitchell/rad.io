# Audio Stream Extraction API

This module provides a clean audio output from raw IQ samples through a complete digital signal processing (DSP) pipeline. It extracts human-understandable audio suitable for AI processing (speech recognition, etc.) from radio signals.

## Table of Contents

- [Overview](#overview)
- [Signal Processing Pipeline](#signal-processing-pipeline)
- [API Reference](#api-reference)
- [Usage Examples](#usage-examples)
- [Demodulation Methods](#demodulation-methods)
- [Integration Guide](#integration-guide)

## Overview

The Audio Stream Extraction API converts raw in-phase/quadrature (IQ) samples from SDR hardware into clean audio suitable for downstream processing including:

- Speech recognition and AI processing
- Audio playback through Web Audio API
- Audio recording and streaming
- Real-time signal analysis

**Key Features:**

- ✅ No external dependencies - uses only Web APIs
- ✅ Supports FM and AM demodulation
- ✅ Configurable sample rates and channel counts (mono/stereo)
- ✅ Built-in de-emphasis filtering for broadcast FM
- ✅ Efficient decimation for sample rate conversion
- ✅ Stereo/mono-agnostic output format
- ✅ Compatible with Web Audio API

## Signal Processing Pipeline

The complete transformation from raw radio input to final audio output:

```
┌─────────────────────────────────────────────────────────────────┐
│                     SIGNAL PROCESSING PIPELINE                   │
└─────────────────────────────────────────────────────────────────┘

1. Raw IQ Samples (from SDR hardware)
   • Complex-valued samples: I (in-phase) and Q (quadrature)
   • Sample rate: Typically 2-20 MHz for SDR devices
   • Format: Int8, Uint8, or Int16 depending on hardware
   ↓

2. Normalization
   • Convert to Float32 range: -1.0 to 1.0
   • Preserve phase and amplitude relationships
   ↓

3. Demodulation (FM or AM)
   ┌────────────────────────────────────────────────────────────┐
   │ FM DEMODULATION                                            │
   │ • Calculate instantaneous phase: φ(t) = atan2(Q, I)       │
   │ • Compute phase difference: Δφ = φ(t) - φ(t-1)           │
   │ • Unwrap phase (handle 2π discontinuities)                │
   │ • Phase difference ∝ frequency deviation                  │
   │ • Normalize to audio range: audio = Δφ / π               │
   └────────────────────────────────────────────────────────────┘
   OR
   ┌────────────────────────────────────────────────────────────┐
   │ AM DEMODULATION                                            │
   │ • Calculate envelope: |signal| = √(I² + Q²)              │
   │ • Remove DC component (IIR high-pass filter)              │
   │ • Normalize to audio range                                │
   └────────────────────────────────────────────────────────────┘
   ↓

4. De-emphasis Filter (FM only)
   • 75μs time constant for broadcast FM (USA standard)
   • IIR low-pass filter: α = 1 / (1 + RC·fs)
   • Compensates for pre-emphasis at transmitter
   • Reduces high-frequency noise
   ↓

5. Audio Decimation
   • Downsample from SDR rate to audio rate
   • Typical output: 48 kHz (CD quality) or 44.1 kHz
   • Linear interpolation for smooth output
   • Anti-aliasing inherent in demodulation
   ↓

6. Audio Output
   • Format: Float32Array (-1.0 to 1.0)
   • Channels: Mono (1) or Stereo (2)
   • Ready for Web Audio API or AI processing
   • Compatible with AudioBuffer for playback
```

### Mathematical Details

#### FM Demodulation

FM (Frequency Modulation) encoding varies the carrier frequency proportional to the audio signal:

```
Transmitted signal: s(t) = A·cos(2πfc·t + 2πkf·∫m(τ)dτ)
where:
  fc = carrier frequency
  kf = frequency deviation constant
  m(t) = audio (modulating) signal
```

To recover m(t):

1. Instantaneous phase: φ(t) = atan2(Q(t), I(t))
2. Instantaneous frequency: f(t) = (1/2π)·dφ/dt
3. Audio signal: m(t) ∝ f(t) - fc

Implementation uses discrete differentiation:

```
Δφ(n) = φ(n) - φ(n-1)
m(n) = Δφ(n) / π  (normalized to ±1)
```

#### AM Demodulation

AM (Amplitude Modulation) varies the carrier amplitude proportional to the audio signal:

```
Transmitted signal: s(t) = [A + m(t)]·cos(2πfc·t)
where:
  A = carrier amplitude
  m(t) = audio (modulating) signal
```

To recover m(t):

1. Envelope detection: envelope(t) = √(I(t)² + Q(t)²)
2. Remove DC: m(t) = envelope(t) - DC_offset

#### De-emphasis Filter

Broadcast FM applies pre-emphasis at the transmitter (high-pass filter) to improve SNR. The receiver must apply de-emphasis (low-pass filter):

```
H(s) = 1 / (1 + s·τ)
where τ = 75μs (USA), 50μs (Europe)

Discrete implementation (IIR):
y[n] = α·x[n] + (1-α)·y[n-1]
where α = 1 / (1 + RC·fs)
```

## API Reference

### Types

#### `DemodulationType`

```typescript
enum DemodulationType {
  FM = "FM", // Frequency modulation
  AM = "AM", // Amplitude modulation
  NONE = "NONE", // No demodulation (raw I channel)
}
```

#### `AudioOutputConfig`

```typescript
type AudioOutputConfig = {
  sampleRate?: number; // Output sample rate in Hz (default: 48000)
  channels?: 1 | 2; // 1 for mono, 2 for stereo (default: 1)
  enableDeEmphasis?: boolean; // Enable FM de-emphasis filter (default: true)
};
```

#### `AudioStreamResult`

```typescript
type AudioStreamResult = {
  audioData: Float32Array; // Demodulated audio samples (-1.0 to 1.0)
  sampleRate: number; // Sample rate of audio data in Hz
  channels: number; // Number of channels (1 or 2)
  demodType: DemodulationType; // Demodulation type used
  audioBuffer: AudioBuffer; // Web Audio API AudioBuffer
};
```

### Classes

#### `AudioStreamProcessor`

Main class for extracting clean audio from IQ samples.

**Constructor:**

```typescript
constructor(sdrSampleRate: number)
```

**Methods:**

##### `extractAudio()`

Extract audio from IQ samples using specified demodulation.

```typescript
async extractAudio(
  samples: IQSample[],
  demodType: DemodulationType,
  config?: AudioOutputConfig
): Promise<AudioStreamResult>
```

##### `reset()`

Reset all demodulator states.

```typescript
reset(): void
```

##### `cleanup()`

Clean up resources (close AudioContext).

```typescript
async cleanup(): Promise<void>
```

### Functions

#### `extractAudioStream()`

Convenience function for one-time audio extraction.

```typescript
async function extractAudioStream(
  samples: IQSample[],
  sdrSampleRate: number,
  demodType: DemodulationType,
  config?: AudioOutputConfig,
): Promise<AudioStreamResult>;
```

**Parameters:**

- `samples` - Array of IQ samples from SDR
- `sdrSampleRate` - Sample rate of the SDR device in Hz
- `demodType` - Type of demodulation (FM, AM, or NONE)
- `config` - Optional audio output configuration

**Returns:** Promise resolving to AudioStreamResult

#### `createAudioStreamCallback()`

Create a callback function for streaming audio processing.

```typescript
function createAudioStreamCallback(
  processor: AudioStreamProcessor,
  demodType: DemodulationType,
  onAudio: (result: AudioStreamResult) => void,
  config?: AudioOutputConfig,
): (samples: IQSample[]) => Promise<void>;
```

**Parameters:**

- `processor` - AudioStreamProcessor instance
- `demodType` - Demodulation type
- `onAudio` - Callback invoked with audio result
- `config` - Optional audio output configuration

**Returns:** Callback function for processing IQ samples

## Usage Examples

### Example 1: Simple FM Demodulation

Extract audio from FM broadcast signal:

```typescript
import { extractAudioStream, DemodulationType } from "./utils/audioStream";
import type { IQSample } from "./models/SDRDevice";

// Receive IQ samples from SDR device
const iqSamples: IQSample[] = device.parseSamples(rawData);
const sdrSampleRate = 2048000; // 2.048 MHz

// Extract FM audio
const result = await extractAudioStream(
  iqSamples,
  sdrSampleRate,
  DemodulationType.FM,
  {
    sampleRate: 48000,
    channels: 1,
    enableDeEmphasis: true,
  },
);

console.log(
  `Audio extracted: ${result.audioData.length} samples at ${result.sampleRate} Hz`,
);
```

### Example 2: Real-time Audio Playback

Stream demodulated audio to speakers:

```typescript
import { AudioStreamProcessor, DemodulationType } from "./utils/audioStream";

const audioContext = new AudioContext();
const processor = new AudioStreamProcessor(2048000);

// Setup audio playback
async function playAudio(audioBuffer: AudioBuffer) {
  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioContext.destination);
  source.start();
}

// Start receiving from SDR
await device.receive(async (dataView) => {
  const iqSamples = device.parseSamples(dataView);

  const result = await processor.extractAudio(iqSamples, DemodulationType.FM, {
    sampleRate: 48000,
  });

  await playAudio(result.audioBuffer);
});
```

### Example 3: AM Radio Demodulation

Demodulate AM broadcast signals:

```typescript
import { AudioStreamProcessor, DemodulationType } from "./utils/audioStream";

const processor = new AudioStreamProcessor(2048000);

const result = await processor.extractAudio(iqSamples, DemodulationType.AM, {
  sampleRate: 48000,
  channels: 1,
});

// Access demodulated audio data
const audioSamples = result.audioData; // Float32Array
```

### Example 4: Streaming with Callback

Process audio continuously using callbacks:

```typescript
import {
  AudioStreamProcessor,
  createAudioStreamCallback,
  DemodulationType,
} from "./utils/audioStream";

const processor = new AudioStreamProcessor(2048000);

// Create callback for audio processing
const callback = createAudioStreamCallback(
  processor,
  DemodulationType.FM,
  (result) => {
    // Process audio result
    console.log(`Received ${result.audioData.length} audio samples`);

    // Send to speech recognition, recording, etc.
    processSpeech(result.audioBuffer);
  },
  { sampleRate: 48000, channels: 1 },
);

// Use with SDR device
await device.receive(async (dataView) => {
  const iqSamples = device.parseSamples(dataView);
  await callback(iqSamples);
});
```

### Example 5: AI/Speech Recognition Integration

Extract audio for speech recognition:

```typescript
import { extractAudioStream, DemodulationType } from "./utils/audioStream";

async function transcribeRadio(iqSamples: IQSample[]) {
  // Extract clean audio
  const result = await extractAudioStream(
    iqSamples,
    2048000,
    DemodulationType.FM,
    { sampleRate: 16000, channels: 1 }, // 16kHz for speech recognition
  );

  // Convert to format expected by speech recognition API
  const audioBlob = await audioBufferToBlob(result.audioBuffer);

  // Send to speech recognition service
  const transcript = await speechRecognitionAPI.transcribe(audioBlob);

  return transcript;
}

// Helper to convert AudioBuffer to Blob
async function audioBufferToBlob(audioBuffer: AudioBuffer): Promise<Blob> {
  const offlineContext = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    audioBuffer.sampleRate,
  );

  // Encode as WAV, MP3, etc.
  // ... implementation details ...
}
```

### Example 6: Stereo Output

Generate stereo audio output:

```typescript
const result = await extractAudioStream(
  iqSamples,
  2048000,
  DemodulationType.FM,
  {
    sampleRate: 48000,
    channels: 2, // Stereo output
  },
);

// Both channels contain the same demodulated audio
console.log(`Channels: ${result.audioBuffer.numberOfChannels}`);
```

### Example 7: Processing Multiple Signals

Process different signal types:

```typescript
const processor = new AudioStreamProcessor(2048000);

// Process FM signal
const fmAudio = await processor.extractAudio(fmSamples, DemodulationType.FM, {
  sampleRate: 48000,
});

// Switch to AM signal
const amAudio = await processor.extractAudio(amSamples, DemodulationType.AM, {
  sampleRate: 48000,
});

// Demodulator state is automatically reset when type changes
```

## Demodulation Methods

### FM (Frequency Modulation)

**Use for:**

- FM broadcast radio (88-108 MHz)
- Two-way radio communications
- Amateur radio FM
- P25 digital voice (after QPSK demodulation)

**Characteristics:**

- Constant amplitude, varying frequency
- Better noise immunity than AM
- Requires de-emphasis filter for broadcast
- Phase discrimination algorithm

**Configuration:**

```typescript
{
  demodType: DemodulationType.FM,
  enableDeEmphasis: true  // For broadcast FM
}
```

### AM (Amplitude Modulation)

**Use for:**

- AM broadcast radio (530-1700 kHz)
- Aviation communications
- Amateur radio AM
- Shortwave broadcasting

**Characteristics:**

- Varying amplitude, constant frequency
- Simpler demodulation than FM
- More susceptible to noise
- Envelope detection algorithm

**Configuration:**

```typescript
{
  demodType: DemodulationType.AM;
}
```

### NONE (Raw IQ)

**Use for:**

- Custom demodulation algorithms
- Raw signal analysis
- Digital signal modes (PSK, QAM, etc.)
- When you want to implement your own demodulation

**Characteristics:**

- Outputs I (in-phase) channel only
- No filtering or processing
- Direct access to baseband signal

**Configuration:**

```typescript
{
  demodType: DemodulationType.NONE;
}
```

## Integration Guide

### Integration with HackRF Device

```typescript
import { useHackRFDevice } from './hooks/useHackRFDevice';
import { AudioStreamProcessor, DemodulationType } from './utils/audioStream';

function RadioComponent() {
  const { device } = useHackRFDevice();
  const [processor] = useState(() => new AudioStreamProcessor(20000000));
  const [audioContext] = useState(() => new AudioContext());

  const startListening = async () => {
    if (!device) return;

    await device.setFrequency(100.3e6); // 100.3 MHz FM
    await device.setSampleRate(20000000); // 20 MHz

    await device.receive(async (dataView) => {
      const iqSamples = device.parseSamples(dataView);

      const result = await processor.extractAudio(
        iqSamples,
        DemodulationType.FM,
        { sampleRate: 48000 }
      );

      // Play audio
      const source = audioContext.createBufferSource();
      source.buffer = result.audioBuffer;
      source.connect(audioContext.destination);
      source.start();
    });
  };

  return (
    <button onClick={startListening}>
      Start FM Reception
    </button>
  );
}
```

### Integration with Signal Type Selector

```typescript
import { SignalType } from "./components/SignalTypeSelector";
import { DemodulationType } from "./utils/audioStream";

function getDemodType(signalType: SignalType): DemodulationType {
  switch (signalType) {
    case "FM":
      return DemodulationType.FM;
    case "AM":
      return DemodulationType.AM;
    case "P25":
      // P25 uses FSK/C4FM modulation
      // First demodulate to symbols, then decode voice
      return DemodulationType.FM;
    default:
      return DemodulationType.NONE;
  }
}
```

### Error Handling

```typescript
import { extractAudioStream, DemodulationType } from "./utils/audioStream";

async function safeExtractAudio(iqSamples: IQSample[], sampleRate: number) {
  try {
    const result = await extractAudioStream(
      iqSamples,
      sampleRate,
      DemodulationType.FM,
    );
    return result;
  } catch (error) {
    console.error("Audio extraction failed:", error);

    // Fallback: return silent audio
    return {
      audioData: new Float32Array(480), // 10ms at 48kHz
      sampleRate: 48000,
      channels: 1,
      demodType: DemodulationType.NONE,
      audioBuffer: new AudioContext().createBuffer(1, 480, 48000),
    };
  }
}
```

### Performance Optimization

For real-time processing, reuse the AudioStreamProcessor instance:

```typescript
// Good: Reuse processor
const processor = new AudioStreamProcessor(2048000);

device.receive(async (data) => {
  const result = await processor.extractAudio(samples, DemodulationType.FM);
  // Process result...
});

// Avoid: Creating new processor each time (slower)
device.receive(async (data) => {
  const processor = new AudioStreamProcessor(2048000); // Don't do this!
  const result = await processor.extractAudio(samples, DemodulationType.FM);
});
```

### Cleanup

Always cleanup resources when done:

```typescript
const processor = new AudioStreamProcessor(2048000);

// ... use processor ...

// When component unmounts or processing ends:
await processor.cleanup();
```

## Testing

The module includes comprehensive tests covering:

- ✅ FM demodulation accuracy
- ✅ AM envelope detection
- ✅ De-emphasis filtering
- ✅ Sample rate conversion
- ✅ Phase unwrapping
- ✅ DC removal
- ✅ Mono/stereo output
- ✅ Edge cases and error handling

Run tests:

```bash
npm test -- audioStream.test.ts
```

## Performance Considerations

**Sample Rate Decimation:**

- Linear interpolation is fast but basic
- For production, consider low-pass filtering before decimation
- Trade-off: quality vs. computational cost

**Demodulator State:**

- FM demodulator maintains phase state
- AM demodulator maintains DC filter state
- Call `reset()` when signal characteristics change significantly

**Memory Usage:**

- AudioContext instances consume resources
- Reuse AudioStreamProcessor for continuous processing
- Call `cleanup()` when done to free AudioContext

**Real-time Processing:**

- Process samples in chunks (e.g., 8192 samples)
- Typical latency: < 10ms for 48kHz output
- Use Web Workers for heavy processing if needed

## Browser Compatibility

Requires modern browsers with:

- Web Audio API support
- ES2015+ features
- Float32Array support

**Tested on:**

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

## License

Part of the rad.io project. See repository LICENSE for details.

## Related Documentation

- [ARCHITECTURE.md](../ARCHITECTURE.md) - Overall system architecture
- [MEMORY_API.md](../MEMORY_API.md) - Memory management for SDR devices
- [src/utils/dsp.ts](./dsp.ts) - FFT and spectrum analysis utilities
- [src/models/SDRDevice.ts](../models/SDRDevice.ts) - Universal SDR device interface
