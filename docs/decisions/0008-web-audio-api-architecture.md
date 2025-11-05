# ADR-0008: Web Audio API Architecture

## Status

Accepted

## Context

SDR applications must demodulate RF signals and present audio to users:

**Audio Requirements**:

- Real-time demodulation (AM, FM, SSB, CW)
- Low latency (< 100ms end-to-end)
- Audio filtering (bandpass, notch filters)
- Volume control and AGC
- Audio recording capability
- Support for 48 kHz sample rate (browser standard)
- Handle sample rate conversion (SDR rates → audio rates)

**Challenges**:

- SDR sample rates (1-20 MSPS) ≠ audio sample rates (48 kHz)
- Decimation required to avoid overwhelming audio system
- Audio glitches unacceptable (cause user distraction)
- Must maintain audio context state across device changes
- Buffer underruns cause pops and clicks

**Web Audio API Architecture**:

- **AudioContext**: Master controller (48 kHz standard)
- **AudioWorklet**: Low-latency audio processing in separate thread
- **AudioBufferSourceNode**: Playback of buffered audio
- **GainNode**: Volume control
- **BiquadFilterNode**: Audio filtering
- **AnalyserNode**: Real-time frequency analysis

## Decision

We will implement a **hybrid audio architecture** using Web Audio API with AudioWorklet for low-latency demodulation:

### Architecture Overview

```
SDR Device → WebUSB/Serial → Main Thread → DSP Worker → AudioWorklet → Speakers
                                    ↓
                              Decimation (IQ → Audio rate)
                              Demodulation (AM/FM/SSB/CW)
```

### Components

#### 1. Audio Pipeline Manager

```typescript
// src/lib/audio/audio-pipeline.ts

export class AudioPipeline {
  private context: AudioContext;
  private workletNode: AudioWorkletNode | null = null;
  private gainNode: GainNode;
  private filterNode: BiquadFilterNode;
  private analyserNode: AnalyserNode;

  constructor() {
    this.context = new AudioContext({ sampleRate: 48000 });
    this.gainNode = this.context.createGain();
    this.filterNode = this.context.createBiquadFilter();
    this.analyserNode = this.context.createAnalyser();

    // Connect nodes
    this.gainNode.connect(this.filterNode);
    this.filterNode.connect(this.analyserNode);
    this.analyserNode.connect(this.context.destination);
  }

  async init() {
    await this.context.audioWorklet.addModule("/src/workers/audio-worklet.js");
    this.workletNode = new AudioWorkletNode(
      this.context,
      "demodulator-processor",
    );
    this.workletNode.connect(this.gainNode);
  }

  feedSamples(samples: Float32Array) {
    if (this.workletNode) {
      this.workletNode.port.postMessage({ samples }, [samples.buffer]);
    }
  }

  setVolume(volume: number) {
    this.gainNode.gain.setValueAtTime(volume, this.context.currentTime);
  }

  setFilter(type: BiquadFilterType, frequency: number, q: number) {
    this.filterNode.type = type;
    this.filterNode.frequency.setValueAtTime(
      frequency,
      this.context.currentTime,
    );
    this.filterNode.Q.setValueAtTime(q, this.context.currentTime);
  }

  setDemodulationMode(mode: "am" | "fm" | "usb" | "lsb" | "cw") {
    this.workletNode?.port.postMessage({ command: "set-mode", mode });
  }

  async suspend() {
    await this.context.suspend();
  }

  async resume() {
    await this.context.resume();
  }

  close() {
    this.workletNode?.disconnect();
    this.context.close();
  }
}
```

#### 2. AudioWorklet Processor

```typescript
// src/workers/audio-worklet.ts

class DemodulatorProcessor extends AudioWorkletProcessor {
  private mode: "am" | "fm" | "usb" | "lsb" | "cw" = "am";
  private inputBuffer: Float32Array[] = [];
  private prevPhase: number = 0;

  constructor() {
    super();

    this.port.onmessage = (event) => {
      if (event.data.command === "set-mode") {
        this.mode = event.data.mode;
      } else if (event.data.samples) {
        this.inputBuffer.push(event.data.samples);
      }
    };
  }

  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean {
    const output = outputs[0];
    if (!output || output.length === 0) return true;

    const outputChannel = output[0];
    const samplesNeeded = outputChannel.length;

    // Check if we have enough buffered samples
    if (this.inputBuffer.length === 0) {
      // Silence if no data
      outputChannel.fill(0);
      return true;
    }

    // Get samples from buffer
    const samples = this.inputBuffer.shift()!;

    // Demodulate based on mode
    let demodulated: Float32Array;
    switch (this.mode) {
      case "am":
        demodulated = this.demodulateAM(samples);
        break;
      case "fm":
        demodulated = this.demodulateFM(samples);
        break;
      case "usb":
      case "lsb":
        demodulated = this.demodulateSSB(samples, this.mode);
        break;
      case "cw":
        demodulated = this.demodulateCW(samples);
        break;
    }

    // Copy to output (with resampling if needed)
    const length = Math.min(demodulated.length, samplesNeeded);
    outputChannel.set(demodulated.subarray(0, length));

    return true;
  }

  private demodulateAM(samples: Float32Array): Float32Array {
    // AM: Extract envelope (magnitude)
    const output = new Float32Array(samples.length / 2);

    for (let i = 0; i < output.length; i++) {
      const iSample = samples[i * 2];
      const qSample = samples[i * 2 + 1];
      output[i] = Math.sqrt(iSample * iSample + qSample * qSample);
    }

    return output;
  }

  private demodulateFM(samples: Float32Array): Float32Array {
    // FM: Phase derivative (atan2 difference)
    const output = new Float32Array(samples.length / 2);

    for (let i = 0; i < output.length; i++) {
      const iSample = samples[i * 2];
      const qSample = samples[i * 2 + 1];

      const phase = Math.atan2(qSample, iSample);
      let phaseDiff = phase - this.prevPhase;

      // Unwrap phase
      if (phaseDiff > Math.PI) phaseDiff -= 2 * Math.PI;
      if (phaseDiff < -Math.PI) phaseDiff += 2 * Math.PI;

      output[i] = phaseDiff;
      this.prevPhase = phase;
    }

    return output;
  }

  private demodulateSSB(
    samples: Float32Array,
    mode: "usb" | "lsb",
  ): Float32Array {
    // SSB: Return I or Q based on mode (simplified)
    const output = new Float32Array(samples.length / 2);
    const sign = mode === "usb" ? 1 : -1;

    for (let i = 0; i < output.length; i++) {
      output[i] = samples[i * 2] + sign * samples[i * 2 + 1];
    }

    return output;
  }

  private demodulateCW(samples: Float32Array): Float32Array {
    // CW: Bandpass filtered AM with audio tone injection
    return this.demodulateAM(samples);
  }
}

registerProcessor("demodulator-processor", DemodulatorProcessor);
```

#### 3. Sample Rate Conversion

```typescript
// src/lib/audio/sample-rate-converter.ts

export class SampleRateConverter {
  private inputRate: number;
  private outputRate: number;
  private decimationFactor: number;
  private lpFilter: Float32Array;

  constructor(inputRate: number, outputRate: number = 48000) {
    this.inputRate = inputRate;
    this.outputRate = outputRate;
    this.decimationFactor = Math.floor(inputRate / outputRate);
    this.lpFilter = this.designLowPassFilter();
  }

  convert(input: Float32Array): Float32Array {
    // Simple decimation with anti-aliasing filter
    const filtered = this.applyLowPass(input);
    const output = new Float32Array(
      Math.floor(input.length / this.decimationFactor),
    );

    for (let i = 0; i < output.length; i++) {
      output[i] = filtered[i * this.decimationFactor];
    }

    return output;
  }

  private designLowPassFilter(): Float32Array {
    // Design FIR low-pass filter at Nyquist / decimation factor
    const taps = 64;
    const cutoff = 0.5 / this.decimationFactor;
    const filter = new Float32Array(taps);

    for (let i = 0; i < taps; i++) {
      const x = i - taps / 2;
      if (x === 0) {
        filter[i] = 2 * cutoff;
      } else {
        filter[i] = Math.sin(2 * Math.PI * cutoff * x) / (Math.PI * x);
      }
      // Apply Hamming window
      filter[i] *= 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (taps - 1));
    }

    return filter;
  }

  private applyLowPass(input: Float32Array): Float32Array {
    const output = new Float32Array(input.length);
    const taps = this.lpFilter.length;

    for (let i = taps; i < input.length; i++) {
      let sum = 0;
      for (let j = 0; j < taps; j++) {
        sum += input[i - j] * this.lpFilter[j];
      }
      output[i] = sum;
    }

    return output;
  }
}
```

#### 4. Audio Recording

```typescript
// src/lib/audio/audio-recorder.ts

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;

  async start(audioPipeline: AudioPipeline) {
    const destination = audioPipeline.context.createMediaStreamDestination();
    audioPipeline.analyserNode.connect(destination);

    this.stream = destination.stream;
    this.mediaRecorder = new MediaRecorder(this.stream, {
      mimeType: "audio/webm;codecs=opus",
    });

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.chunks.push(event.data);
      }
    };

    this.mediaRecorder.start(100); // Capture in 100ms chunks
  }

  async stop(): Promise<Blob> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
        resolve(new Blob());
        return;
      }

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: "audio/webm" });
        this.chunks = [];
        resolve(blob);
      };

      this.mediaRecorder.stop();
      this.stream?.getTracks().forEach((track) => track.stop());
    });
  }
}
```

### Buffer Management Strategy

**Ring Buffer** for smooth playback:

```typescript
class AudioRingBuffer {
  private buffer: Float32Array;
  private writePos: number = 0;
  private readPos: number = 0;
  private size: number;

  constructor(sizeInSeconds: number, sampleRate: number) {
    this.size = sizeInSeconds * sampleRate;
    this.buffer = new Float32Array(this.size);
  }

  write(samples: Float32Array) {
    const available = this.size - this.getOccupancy();
    const toWrite = Math.min(samples.length, available);

    for (let i = 0; i < toWrite; i++) {
      this.buffer[this.writePos] = samples[i];
      this.writePos = (this.writePos + 1) % this.size;
    }
  }

  read(output: Float32Array): number {
    const available = this.getOccupancy();
    const toRead = Math.min(output.length, available);

    for (let i = 0; i < toRead; i++) {
      output[i] = this.buffer[this.readPos];
      this.readPos = (this.readPos + 1) % this.size;
    }

    return toRead;
  }

  getOccupancy(): number {
    const diff = this.writePos - this.readPos;
    return diff >= 0 ? diff : this.size + diff;
  }
}
```

## Consequences

### Positive

- **Low Latency**: AudioWorklet runs on audio thread (< 10ms)
- **No Blocking**: Audio processing doesn't block UI
- **Hardware Acceleration**: Web Audio API uses native audio subsystem
- **Standard API**: Works across all modern browsers
- **Recording Support**: Can capture demodulated audio
- **Filter Chain**: Built-in DSP nodes for audio processing

### Negative

- **Complexity**: AudioWorklet requires separate file and build config
- **Sample Rate Fixed**: AudioContext typically locked to 48 kHz
- **Buffer Management**: Must handle underruns gracefully
- **Debugging**: AudioWorklet harder to debug than main thread
- **Limited DSP**: Some advanced algorithms need custom implementation

### Neutral

- Must handle AudioContext suspension on mobile (user gesture required)
- Can't access DOM from AudioWorklet
- Transferable objects for zero-copy

## Performance Targets

- End-to-end latency: < 100ms
- AudioWorklet processing: < 5ms per 128-sample frame
- Buffer underruns: < 1 per hour
- CPU usage: < 10% on reference hardware
- Memory: < 50 MB for audio pipeline

## Browser Compatibility

- **AudioWorklet**: Chrome 66+, Firefox 76+, Safari 14.1+
- **AudioContext**: 100% modern browsers
- Fallback to ScriptProcessorNode (deprecated but works)

## Testing Strategy

- Unit tests for demodulation algorithms
- Integration tests for audio pipeline
- Latency measurements in CI
- Buffer underrun stress tests
- Cross-browser audio output validation

## Alternatives Considered

### Alternative 1: ScriptProcessorNode

**Rejected**: Deprecated, runs on main thread, higher latency

### Alternative 2: WebAssembly Audio Processing

**Deferred**: Can add later for complex demodulation

### Alternative 3: Decode in Worker, No AudioWorklet

**Rejected**: Higher latency due to message passing

### Alternative 4: Native Audio Libraries via WebAssembly

**Deferred**: Complexity outweighs benefits for initial version

## References

### W3C Standards and Specifications

- [Web Audio API Specification](https://www.w3.org/TR/webaudio/) - W3C Recommendation for high-level audio processing
- [AudioWorklet - MDN](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet) - Low-latency audio processing API documentation

### Academic Research and Technical Articles

- "Understanding AudioWorklet: A Deep Dive Into Web Audio API." PeerDH (2024). [Technical Guide](https://peerdh.com/blogs/programming-insights/understanding-audioworklet-a-deep-dive-into-web-audio-api) - Comprehensive analysis of AudioWorklet architecture and performance
- "Real-Time Audio Worklet Recorder." GitHub (2024). [Implementation](https://github.com/alyssonbarrera/audio-worklet-recorder) - Production example with low-latency streaming, resampling, and WebSocket integration
- Stack Overflow. "Using AudioWorkletProcessor for low-latency audio scheduling." [Technical Discussion](https://stackoverflow.com/questions/62505257/using-audioworkletprocessor-for-low-latency-audio-scheduling) - Best practices for timing precision
- [Emscripten Wasm Audio Worklets](https://emscripten.org/docs/api_reference/wasm_audio_worklets.html) - C/C++ audio processing compiled to WebAssembly

### Conference Papers and Industry Resources

- "Enter Audio Worklet" - Web Audio Conference 2018 - Introduction to AudioWorklet design patterns
- "Audio Worklet Design Pattern" - Google Developers - Best practices from Chrome audio team

### DSP References

- [Sample Rate Conversion Algorithms](https://ccrma.stanford.edu/~jos/resample/) - Julius O. Smith III, Stanford CCRMA - Mathematical foundations for resampling

### Related ADRs

- ADR-0002: Web Worker DSP Architecture (demodulation processing before audio output)
- ADR-0011: Error Handling and Resilience Strategy (audio underrun recovery)
