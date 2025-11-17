# Audio Stream Extraction API

This module provides clean audio output from raw IQ samples through a complete digital signal processing (DSP) pipeline. It extracts human-understandable audio suitable for AI processing (speech recognition, etc.) from radio signals.

## Recent Updates

**AudioWorklet Support** - Low-latency, deterministic audio processing using AudioWorklet API for stable real-time performance.

**Extended Demodulation** - Support for NFM, WFM, USB, LSB, and CW in addition to FM and AM.

**AGC & Squelch** - Automatic Gain Control with multiple modes (off, slow, medium, fast) and configurable squelch threshold.

**Improved Resampling** - High-quality windowed sinc interpolation resampler with configurable quality levels.

**Deemphasis Control** - Configurable deemphasis time constant (75μs USA, 50μs Europe) with enable/disable toggle.

## Table of Contents

- [Overview](#overview)
- [Signal Processing Pipeline](#signal-processing-pipeline)
- [API Reference](#api-reference)
- [Usage Examples](#usage-examples)
- [Demodulation Methods](#demodulation-methods)
- [AudioWorklet Mode](#audioworklet-mode)
- [AGC and Squelch](#agc-and-squelch)
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

```text
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

```text
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

```text
Δφ(n) = φ(n) - φ(n-1)
m(n) = Δφ(n) / π  (normalized to ±1)
```

#### AM Demodulation

AM (Amplitude Modulation) varies the carrier amplitude proportional to the audio signal:

```text
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

```text
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

## AudioWorklet Mode

For production use with low-latency, stable audio processing, use AudioWorklet mode.

### What is AudioWorklet?

AudioWorklet is a modern Web Audio API that runs audio processing on the audio rendering thread, providing:

- **Deterministic performance** - Processing happens on a dedicated high-priority thread
- **Low latency** - Typical latency < 10ms (vs. 50-100ms for ScriptProcessorNode)
- **Stable under load** - Audio continues even when main thread is busy
- **No glitches** - Immune to JavaScript garbage collection pauses

### When to Use AudioWorklet

Use AudioWorklet when:

- Building a production application
- Real-time audio playback is critical
- System is under heavy CPU load
- Low latency is important (<20ms)
- Audio must remain stable during UI updates

Use standard mode when:

- Quick prototyping or testing
- Offline processing (not real-time)
- AudioWorklet is not supported (older browsers)
- Processing is not time-critical

### Enabling AudioWorklet

```typescript
import { AudioStreamProcessor, DemodulationType } from "./utils/audioStream";

const processor = new AudioStreamProcessor(2048000); // 2.048 MHz SDR

// Initialize AudioWorklet (one-time setup)
await processor.initializeAudioWorklet({
  agcMode: "medium",
  agcTarget: 0.5,
  squelchThreshold: 0.1, // 10% squelch
  deemphasisEnabled: true,
  deemphasisTau: 75, // USA standard
  volume: 1.0,
});

// Process samples (audio plays directly through AudioWorklet)
device.receive(async (dataView) => {
  const iqSamples = device.parseSamples(dataView);

  // When useAudioWorklet is true, audio is played directly
  processor.extractAudio(iqSamples, DemodulationType.WFM, {
    useAudioWorklet: true,
    sampleRate: 48000,
  });
});
```

### AudioWorklet Configuration

```typescript
interface AudioWorkletConfig {
  demodType: WorkletDemodType; // AM, FM, NFM, WFM, USB, LSB, CW
  agcMode?: AGCMode; // OFF, SLOW, MEDIUM, FAST
  agcTarget?: number; // Target RMS 0.0-1.0
  squelchThreshold?: number; // 0.0-1.0, 0.0 = off
  deemphasisEnabled?: boolean; // true for FM/WFM
  deemphasisTau?: number; // 75 (USA) or 50 (Europe) μs
  volume?: number; // 0.0-1.0
  latencyHint?: "interactive" | "balanced" | "playback";
}
```

### Dynamic Control

Update AudioWorklet parameters in real-time:

```typescript
// Change demodulation type
processor.audioWorkletManager?.setDemodType(WorkletDemodType.NFM);

// Adjust AGC
processor.audioWorkletManager?.setAGCMode(AGCMode.FAST);
processor.audioWorkletManager?.setAGCTarget(0.7);

// Control squelch
processor.audioWorkletManager?.setSquelchThreshold(0.15);

// Toggle deemphasis
processor.audioWorkletManager?.setDeemphasisEnabled(false);

// Adjust volume
processor.audioWorkletManager?.setVolume(0.8);
```

## AGC and Squelch

### Automatic Gain Control (AGC)

AGC automatically adjusts audio levels to maintain consistent output volume despite varying signal strengths.

#### AGC Modes

**OFF** - No automatic gain control

- Use when signal levels are already consistent
- Manual volume control preferred
- Fastest processing (no overhead)

**SLOW** - Slow adaptation (2s attack, 500ms decay)

- Best for SSB voice communications
- Preserves audio dynamics
- Minimal "breathing" artifacts
- Natural sound quality

**MEDIUM** - Balanced adaptation (200ms attack, 50ms decay)

- Good for AM/FM broadcast
- Moderate response to level changes
- Balance between speed and artifacts

**FAST** - Fast adaptation (10ms attack, 100ms decay)

- Best for weak or fading signals
- Quick response to level changes
- May cause "pumping" on strong signals
- Use with caution on music

#### AGC Target

The `agcTarget` parameter sets the desired RMS output level:

```typescript
{
  agcMode: "medium",
  agcTarget: 0.5, // Target RMS = 0.5 (moderate)
}
```

- **0.3-0.4**: Quiet, lots of headroom
- **0.5**: Default, balanced
- **0.6-0.7**: Louder, good for weak signals
- **0.8+**: Maximum, risk of clipping

### Squelch

Squelch mutes audio output when the signal level falls below a threshold, eliminating noise between transmissions.

```typescript
{
  squelchThreshold: 0.1, // 10% threshold
}
```

- **0.0**: Squelch off (always open)
- **0.05-0.1**: Sensitive, opens on weak signals
- **0.1-0.2**: Normal, good for most uses
- **0.2-0.3**: Tight, only strong signals open squelch
- **0.3+**: Very tight, may miss weak signals

#### Squelch Hysteresis

The squelch includes automatic hysteresis to prevent "chattering":

- Opens when signal > threshold
- Closes when signal < threshold × 0.7
- Provides smooth, stable operation

### Using AGC and Squelch Together

Typical NFM (Narrow FM) configuration:

```typescript
const result = processor.extractAudio(iqSamples, DemodulationType.NFM, {
  sampleRate: 48000,
  agcMode: "medium",
  agcTarget: 0.6,
  squelchThreshold: 0.15, // 15% squelch
  deemphasisEnabled: true,
  deemphasisTau: 75,
});
```

Typical SSB configuration:

```typescript
const result = processor.extractAudio(iqSamples, DemodulationType.USB, {
  sampleRate: 48000,
  agcMode: "slow",
  agcTarget: 0.5,
  squelchThreshold: 0.0, // No squelch for SSB
  deemphasisEnabled: false, // No deemphasis for SSB
});
```

## New Demodulation Types

### NFM (Narrow FM)

Narrow FM for two-way radio, amateur radio repeaters, and business band communications.

```typescript
{
  demodType: DemodulationType.NFM,
  deemphasisEnabled: true,
  squelchThreshold: 0.15, // Important for NFM
}
```

**Characteristics:**

- Bandwidth: 10-25 kHz
- Use with squelch for best results
- Common on VHF/UHF (144-148 MHz, 420-450 MHz)
- Deemphasis recommended (75μs or 50μs)

### WFM (Wide FM)

Wide FM for broadcast radio (88-108 MHz).

```typescript
{
  demodType: DemodulationType.WFM,
  deemphasisEnabled: true,
  deemphasisTau: 75, // USA: 75μs, Europe: 50μs
  agcMode: "medium",
}
```

**Characteristics:**

- Bandwidth: 200 kHz
- Highest audio quality
- Stereo capable (requires MPX decoder)
- Always use deemphasis for broadcast

### USB/LSB (Single Sideband)

Upper and Lower Sideband for amateur radio HF communications.

```typescript
// Upper Sideband
{
  demodType: DemodulationType.USB,
  agcMode: "slow",
  agcTarget: 0.5,
  deemphasisEnabled: false,
}

// Lower Sideband
{
  demodType: DemodulationType.LSB,
  agcMode: "slow",
  agcTarget: 0.5,
  deemphasisEnabled: false,
}
```

**Characteristics:**

- Bandwidth: 2.4-3 kHz
- Common on HF bands (3-30 MHz)
- No deemphasis needed
- AGC highly recommended (slow mode)
- No squelch (use on voice only)

**When to use USB vs LSB:**

- **USB**: Above 9 MHz (20m, 15m, 10m bands)
- **LSB**: Below 9 MHz (80m, 40m, 30m bands)

### CW (Continuous Wave)

Morse code demodulation with built-in audio tone generation.

```typescript
{
  demodType: DemodulationType.CW,
  agcMode: "fast",
  agcTarget: 0.6,
  deemphasisEnabled: false,
}
```

**Characteristics:**

- Produces ~800 Hz audio tone
- Fast AGC for good copy
- Very narrow bandwidth
- Use with BFO offset for proper tone

## Performance Considerations

### Resampling Quality

The resampler uses linear interpolation for low latency and minimal CPU:

```typescript
// Internal: Uses LinearResampler
const resampler = new LinearResampler(2048000, 48000);
```

For offline processing requiring higher quality, use AudioResampler:

```typescript
import { AudioResampler, ResamplerQuality } from "./utils/audioResampler";

const resampler = new AudioResampler(
  2048000,
  48000,
  ResamplerQuality.HIGH, // or VERY_HIGH for best quality
);
```

### CPU Usage

Typical CPU usage (as % of single core):

- **Linear resampling**: <1%
- **AM demodulation**: <2%
- **FM demodulation**: <3%
- **SSB demodulation**: <5%
- **AGC (medium)**: <1%
- **Squelch**: <0.5%

**AudioWorklet mode adds minimal overhead** (~0.5%) but provides stable performance under load.

### Memory Usage

- AudioContext: ~2-5 MB
- AudioWorklet buffer: ~64 KB
- Resampler state: ~128 bytes
- Demodulator state: ~64 bytes

Total memory footprint: **<10 MB** for typical usage.

## Browser Support

### Standard Mode

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

### AudioWorklet Mode

- ✅ Chrome 66+
- ✅ Firefox 76+
- ✅ Safari 14.1+
- ✅ Edge 79+

**Note:** AudioWorklet requires HTTPS or localhost for security.

## Migration from ScriptProcessorNode

If migrating from deprecated ScriptProcessorNode:

**Before:**

```typescript
const processor = audioContext.createScriptProcessor(4096, 1, 1);
processor.onaudioprocess = (e) => {
  // Process audio...
};
```

**After:**

```typescript
const manager = new AudioWorkletManager();
await manager.initialize({
  demodType: WorkletDemodType.FM,
  agcMode: AGCMode.MEDIUM,
});
manager.processSamples(iqSamples);
```

Benefits:

- 5-10x lower latency
- No audio glitches during GC
- Runs on dedicated audio thread
- Future-proof (ScriptProcessor is deprecated)

## License

Part of the rad.io project. See repository LICENSE for details.

## Related Documentation

- [ARCHITECTURE.md](../ARCHITECTURE.md) - Overall system architecture
- [src/utils/dsp.ts](./dsp.ts) - FFT and spectrum analysis utilities
- [src/models/SDRDevice.ts](../models/SDRDevice.ts) - Universal SDR device interface
- [src/workers/audio-processor.worklet.ts](../workers/audio-processor.worklet.ts) - AudioWorklet processor implementation
- [src/utils/audioWorkletManager.ts](./audioWorkletManager.ts) - AudioWorklet manager
- [src/utils/audioResampler.ts](./audioResampler.ts) - Audio resampling utilities
