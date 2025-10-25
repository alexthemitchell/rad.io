# Audio Demodulation Pipeline

This document describes the audio demodulation pipeline implementation for WebSDR Pro, which enables real-time listening to AM, FM, SSB, and CW signals.

## Architecture Overview

The audio pipeline consists of several key components:

```
IQ Samples (SDR) → Sample Rate Converter → AudioWorklet Demodulator → Web Audio API → Speakers
     2.048 MSPS           ↓                        ↓                       ↓
                      48 kSPS                 Demodulated              Filtered
                                                 Audio                  Audio
```

## Components

### 1. AudioPipeline

The main audio pipeline manager that coordinates all audio processing.

**Location**: `src/lib/audio/audio-pipeline.ts`

**Responsibilities**:

- Initialize Web Audio API context
- Create and manage AudioWorklet processor
- Configure audio filters (bandpass, lowpass)
- Control volume and gain
- Manage audio analysis nodes

**Key Methods**:

```typescript
async init(): Promise<void>
feedSamples(samples: Float32Array): void
setDemodulatorConfig(config: DemodulatorConfig): void
setVolume(volume: number): void
setSquelch(level: number): void
setAGC(enabled: boolean): void
```

### 2. AudioWorklet Processor

Low-latency audio processing that runs on the audio thread.

**Location**: `src/workers/audio-worklet.js`

**Responsibilities**:

- Demodulate IQ samples to audio
- Implement demodulation algorithms (AM, FM, USB, LSB, CW)
- Apply AGC (Automatic Gain Control)
- Apply squelch
- Noise blanking

**Demodulation Algorithms**:

#### AM (Amplitude Modulation)

```javascript
// Extract envelope magnitude
magnitude = sqrt(I² + Q²)
audio = magnitude - DC_offset
```

#### FM (Frequency Modulation)

```javascript
// Phase derivative
phase = atan2(Q, I)
phaseDiff = phase - prevPhase
audio = phaseDiff / (2π)
```

#### USB (Upper Sideband)

```javascript
// Phasing method
audio = I - Q;
```

#### LSB (Lower Sideband)

```javascript
// Phasing method
audio = I + Q;
```

#### CW (Continuous Wave)

```javascript
// AM demodulation with audio tone injection
magnitude = sqrt(I² + Q²)
audio = magnitude * sin(700Hz_tone)
```

### 3. Sample Rate Converter

Converts SDR sample rates (MHz range) to audio sample rates (48 kHz).

**Location**: `src/lib/audio/sample-rate-converter.ts`

**Algorithm**:

1. Apply anti-aliasing low-pass filter
2. Decimate to target sample rate
3. Use windowed sinc filter for optimal response

**Filter Design**:

- FIR low-pass filter
- Hamming window for sidelobe reduction
- Cutoff at Nyquist / decimation_factor

### 4. AudioManager

High-level manager that coordinates the entire audio subsystem.

**Location**: `src/lib/audio/audio-manager.ts`

**Features**:

- Manages AudioPipeline lifecycle
- Handles sample rate conversion
- Synchronizes with application state
- Provides convenient API for UI components

### 5. React Hook

Custom hook for integrating audio pipeline with React components.

**Location**: `src/hooks/use-audio-pipeline.ts`

**Usage**:

```typescript
const audioPipeline = useAudioPipeline({
  enabled: true,
  sampleRate: 48000,
  inputSampleRate: 2048000,
});

// Process IQ samples
audioPipeline.processIQSamples(iqSamples);

// Change demodulation mode
audioPipeline.setMode("FM");
```

## Signal Processing Details

### DC Offset Removal

DC offset in IQ samples causes audio artifacts:

```javascript
dcOffsetI = alpha * I + (1 - alpha) * prevDcOffsetI;
dcOffsetQ = alpha * Q + (1 - alpha) * prevDcOffsetQ;
I_corrected = I - dcOffsetI;
Q_corrected = Q - dcOffsetQ;
```

Where `alpha = 0.001` provides slow tracking of DC drift.

### Automatic Gain Control (AGC)

AGC maintains consistent audio output levels:

```javascript
peak = max(abs(samples));
error = targetLevel - peak;

if (error < 0) {
  gain -= attack * abs(error); // Fast attack
} else {
  gain += decay * error; // Slow decay
}

output = input * gain;
```

Parameters:

- `targetLevel = 0.5` (50% of full scale)
- `attack = 0.001` (fast response to loud signals)
- `decay = 0.0001` (slow recovery)

### Squelch

Squelch mutes audio when signal strength is below threshold:

```javascript
power = sqrt(sum(samples²) / N)
if (power < threshold) {
  output = silence
} else {
  output = audio
}
```

### Noise Blanker

Removes impulse noise by detecting and replacing outliers:

```javascript
mean = average(abs(samples))
for each sample {
  if (abs(sample) > threshold * mean) {
    sample = previousSample  // Replace spike
  }
}
```

## Audio Filter Configuration

Different modes require different audio filtering:

| Mode | Filter Type | Center Freq | Bandwidth | Q Factor |
| ---- | ----------- | ----------- | --------- | -------- |
| AM   | Bandpass    | 1000 Hz     | ~2 kHz    | 1.0      |
| FM   | Lowpass     | 15000 Hz    | 30 kHz    | 0.707    |
| USB  | Bandpass    | 1500 Hz     | ~600 Hz   | 5.0      |
| LSB  | Bandpass    | 1500 Hz     | ~600 Hz   | 5.0      |
| CW   | Bandpass    | 700 Hz      | ~140 Hz   | 10.0     |

## Performance Considerations

### Latency Budget

Total end-to-end latency target: < 100ms

| Component               | Typical Latency | Notes                 |
| ----------------------- | --------------- | --------------------- |
| Sample rate conversion  | ~10ms           | Buffer size dependent |
| AudioWorklet processing | ~3ms            | 128 samples @ 48kHz   |
| Web Audio routing       | ~5ms            | Browser dependent     |
| Audio hardware          | ~10-30ms        | System dependent      |
| **Total**               | **~30-50ms**    | Within target         |

### CPU Usage

Typical CPU usage on modern hardware:

- Sample rate conversion: 2-3%
- AudioWorklet demodulation: 1-2%
- Audio filtering: <1%
- **Total: ~5%**

### Memory Usage

- AudioPipeline: ~1 MB
- Sample rate converter buffers: ~500 KB
- AudioWorklet: ~200 KB
- **Total: ~2 MB**

## Browser Compatibility

| Feature           | Chrome | Firefox | Safari   | Edge   |
| ----------------- | ------ | ------- | -------- | ------ |
| Web Audio API     | ✅ 66+ | ✅ 76+  | ✅ 14.1+ | ✅ 79+ |
| AudioWorklet      | ✅ 66+ | ✅ 76+  | ✅ 14.1+ | ✅ 79+ |
| SharedArrayBuffer | ✅ 68+ | ✅ 79+  | ✅ 15.2+ | ✅ 79+ |

## Testing

### Unit Tests

Test demodulation algorithms with known signals:

```typescript
// Test AM demodulation
const carrier = generateAMSignal(1000, 0.5, 48000);
const demodulated = demodulateAM(carrier);
expect(demodulated).toHaveFrequency(1000);
```

### Integration Tests

Test complete audio pipeline:

```typescript
const pipeline = new AudioPipeline();
await pipeline.init();

const testSignal = generateIQSignal();
pipeline.feedSamples(testSignal);

const output = pipeline.getAnalyserData();
expect(output).toBeDefined();
```

### Performance Tests

Measure latency and CPU usage:

```typescript
const samples = new Float32Array(2048);
const start = performance.now();
pipeline.processIQSamples(samples);
const latency = performance.now() - start;
expect(latency).toBeLessThan(10); // ms
```

## Troubleshooting

### No Audio Output

**Symptoms**: AudioWorklet initialized but no sound

**Possible Causes**:

1. AudioContext suspended (requires user gesture)
   - Solution: Call `audioPipeline.resume()` after user interaction
2. Volume set to zero
   - Solution: Check volume slider setting
3. Browser autoplay policy blocking audio
   - Solution: Require user click before starting audio

### Audio Distortion

**Symptoms**: Harsh, clipped, or distorted audio

**Possible Causes**:

1. AGC gain too high
   - Solution: Reduce input signal level or adjust AGC parameters
2. DC offset not removed
   - Solution: Check DC offset removal algorithm
3. Sample rate mismatch
   - Solution: Verify sample rate converter configuration

### Audio Dropouts

**Symptoms**: Intermittent silence or stuttering

**Possible Causes**:

1. Buffer underruns
   - Solution: Increase buffer size in AudioWorklet
2. CPU overload
   - Solution: Reduce FFT size or disable heavy processing
3. Sample rate conversion artifacts
   - Solution: Use higher quality resampling filter

### High Latency

**Symptoms**: Noticeable delay between tuning and audio change

**Possible Causes**:

1. Large buffer sizes
   - Solution: Reduce buffer size (trade-off with stability)
2. Multiple sample rate conversions
   - Solution: Optimize conversion pipeline
3. Browser audio backend issues
   - Solution: Try different latencyHint settings

## Future Enhancements

### Planned Features

1. **Advanced Demodulation**
   - Digital mode demodulation (PSK31, RTTY, FT8)
   - Stereo FM with pilot tone detection
   - DRM (Digital Radio Mondiale)

2. **Audio Processing**
   - Parametric EQ
   - Notch filters for interference removal
   - Audio compression/limiting
   - Noise reduction algorithms

3. **Recording**
   - Multi-format audio recording (WAV, FLAC, Opus)
   - Time-shift buffer
   - Scheduled recording

4. **Analysis**
   - Real-time audio spectrum analyzer
   - Spectrogram display
   - SINAD meter
   - THD measurement

## References

- [Web Audio API Specification](https://www.w3.org/TR/webaudio/)
- [AudioWorklet Design Pattern](https://developers.google.com/web/updates/2017/12/audio-worklet)
- "Digital Signal Processing" by John G. Proakis
- "Software Receiver Design" by C. Richard Johnson, Jr.
- [Sample Rate Conversion](https://ccrma.stanford.edu/~jos/resample/)
- [FM Demodulation Techniques](https://www.dsprelated.com/showarticle/1032.php)
