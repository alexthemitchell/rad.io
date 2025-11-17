/**
 * Audio Processor AudioWorklet
 *
 * High-performance, low-latency audio demodulation and processing.
 * Runs on the audio rendering thread for stable, deterministic audio output.
 *
 * Features:
 * - AM/FM/NFM/WFM/SSB/CW demodulation
 * - Automatic Gain Control (AGC)
 * - Squelch (noise gate)
 * - WFM deemphasis (75μs/50μs)
 * - Audio resampling
 * - DC blocking
 *
 * @module audio-processor.worklet
 */

// AudioWorklet global types
declare const sampleRate: number;
declare const _currentFrame: number;
declare const _currentTime: number;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean;
}
declare function registerProcessor(
  name: string,
  processorCtor: new (
    options: AudioWorkletNodeOptions,
  ) => AudioWorkletProcessor,
): void;

/**
 * Demodulation types supported by the processor
 */
enum DemodType {
  AM = 0,
  FM = 1,
  NFM = 2,
  WFM = 3,
  USB = 4, // Upper sideband
  LSB = 5, // Lower sideband
  CW = 6, // Continuous wave (morse)
}

/**
 * AGC (Automatic Gain Control) modes
 */
enum AGCMode {
  OFF = 0,
  SLOW = 1,
  MEDIUM = 2,
  FAST = 3,
}

/**
 * Audio Processor Parameters
 */
interface AudioProcessorParams {
  demodType: DemodType;
  agcMode: AGCMode;
  agcTarget: number; // Target RMS level (0.0 - 1.0)
  squelchThreshold: number; // Squelch threshold (0.0 - 1.0)
  deemphasisEnabled: boolean;
  deemphasisTau: number; // Time constant in microseconds (75 or 50)
  volume: number; // Output volume (0.0 - 1.0)
}

/**
 * IQ Sample structure
 */
interface IQSample {
  I: number;
  Q: number;
}

/**
 * AudioWorkletProcessor for real-time audio demodulation
 *
 * This processor receives IQ samples through its input and outputs
 * demodulated audio through its output. All processing happens on the
 * audio rendering thread for deterministic, low-latency operation.
 */
class AudioProcessor extends AudioWorkletProcessor {
  // Demodulator state
  private previousPhase = 0;
  private deEmphasisState = 0;
  private dcBlockerState = 0;
  private dcBlockerPrevInput = 0;

  // AGC state
  private agcGain = 1.0;
  private agcRmsEstimate = 0.1;

  // Squelch state
  private squelchOpen = true;
  private squelchRmsEstimate = 0.0;

  // CW filter state (for morse code)
  private cwFilterState = 0;

  // SSB filter state
  private ssbHilbertBuffer: Float32Array;
  private ssbHilbertIndex = 0;

  // Configuration
  private demodType: DemodType = DemodType.FM;
  private agcMode: AGCMode = AGCMode.MEDIUM;
  private agcTarget = 0.5;
  private squelchThreshold = 0.0;
  private deemphasisEnabled = true;
  private deemphasisTau = 75; // microseconds
  private volume = 1.0;

  // Filter coefficients (calculated from sample rate)
  private deEmphasisAlpha = 0.5;
  private dcBlockerAlpha = 0.9999;
  private agcAttackAlpha = 0.99;
  private agcDecayAlpha = 0.9999;
  private squelchAlpha = 0.99;
  private cwFilterAlpha = 0.9;

  // Input buffer for IQ samples
  private iqBuffer: IQSample[] = [];

  constructor(_options?: AudioWorkletNodeOptions) {
    super();

    // Initialize Hilbert transform buffer for SSB
    this.ssbHilbertBuffer = new Float32Array(64);

    // Set up parameter listeners
    this.port.onmessage = (event: MessageEvent): void => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { type, params } = event.data;

      if (type === "configure") {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        this.updateConfiguration(params);
      } else if (type === "iqSamples") {
        // Receive IQ samples from main thread
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const samples = event.data.samples as IQSample[];
        this.iqBuffer.push(...samples);
      }
    };

    // Calculate filter coefficients based on sample rate
    this.updateFilterCoefficients(sampleRate);
  }

  /**
   * Update filter coefficients based on sample rate
   */
  private updateFilterCoefficients(fs: number): void {
    // De-emphasis filter: α = 1 / (1 + RC*fs)
    const RC = this.deemphasisTau * 1e-6; // Convert μs to seconds
    this.deEmphasisAlpha = this.deemphasisEnabled ? 1 / (1 + RC * fs) : 1.0;

    // DC blocker: High-pass at ~0.5 Hz
    const dcCutoffHz = 0.5;
    this.dcBlockerAlpha = 1 - (2 * Math.PI * dcCutoffHz) / fs;

    // AGC time constants (attack/decay)
    // Attack: how quickly AGC responds to increases in level
    // Decay: how quickly AGC responds to decreases in level
    const agcAttackMs = this.getAGCAttackTime();
    const agcDecayMs = this.getAGCDecayTime();
    this.agcAttackAlpha = Math.exp(-1 / (fs * (agcAttackMs / 1000)));
    this.agcDecayAlpha = Math.exp(-1 / (fs * (agcDecayMs / 1000)));

    // Squelch time constant (smoothing)
    const squelchMs = 50; // 50ms smoothing
    this.squelchAlpha = Math.exp(-1 / (fs * (squelchMs / 1000)));

    // CW filter: Low-pass for morse code audio (~800 Hz)
    const cwCutoffHz = 800;
    this.cwFilterAlpha = Math.exp((-2 * Math.PI * cwCutoffHz) / fs);
  }

  /**
   * Get AGC attack time based on mode
   */
  private getAGCAttackTime(): number {
    switch (this.agcMode) {
      case AGCMode.OFF:
        return 0;
      case AGCMode.FAST:
        return 10; // 10ms
      case AGCMode.MEDIUM:
        return 50; // 50ms
      case AGCMode.SLOW:
        return 200; // 200ms
    }
  }

  /**
   * Get AGC decay time based on mode
   */
  private getAGCDecayTime(): number {
    switch (this.agcMode) {
      case AGCMode.OFF:
        return 0;
      case AGCMode.FAST:
        return 100; // 100ms
      case AGCMode.MEDIUM:
        return 500; // 500ms
      case AGCMode.SLOW:
        return 2000; // 2s
    }
  }

  /**
   * Update configuration from main thread
   */
  private updateConfiguration(params: Partial<AudioProcessorParams>): void {
    if (params.demodType !== undefined) {
      this.demodType = params.demodType;
      this.reset();
    }
    if (params.agcMode !== undefined) {
      this.agcMode = params.agcMode;
      this.updateFilterCoefficients(sampleRate);
    }
    if (params.agcTarget !== undefined) {
      this.agcTarget = params.agcTarget;
    }
    if (params.squelchThreshold !== undefined) {
      this.squelchThreshold = params.squelchThreshold;
    }
    if (params.deemphasisEnabled !== undefined) {
      this.deemphasisEnabled = params.deemphasisEnabled;
      this.updateFilterCoefficients(sampleRate);
    }
    if (params.deemphasisTau !== undefined) {
      this.deemphasisTau = params.deemphasisTau;
      this.updateFilterCoefficients(sampleRate);
    }
    if (params.volume !== undefined) {
      this.volume = params.volume;
    }
  }

  /**
   * Reset demodulator state
   */
  private reset(): void {
    this.previousPhase = 0;
    this.deEmphasisState = 0;
    this.dcBlockerState = 0;
    this.dcBlockerPrevInput = 0;
    this.agcGain = 1.0;
    this.agcRmsEstimate = 0.1;
    this.squelchOpen = true;
    this.squelchRmsEstimate = 0.0;
    this.cwFilterState = 0;
    this.ssbHilbertBuffer.fill(0);
    this.ssbHilbertIndex = 0;
  }

  /**
   * Main processing function called by the audio system
   */
  override process(
    _inputs: Float32Array[][],
    outputs: Float32Array[][],
    _parameters: Record<string, Float32Array>,
  ): boolean {
    const output = outputs[0];
    if (!output || output.length === 0) {
      return true;
    }

    const outputChannel = output[0];
    if (!outputChannel) {
      return true;
    }

    const blockSize = outputChannel.length;

    // Check if we have IQ samples to process
    if (this.iqBuffer.length < blockSize) {
      // Not enough samples - output silence
      outputChannel.fill(0);
      return true;
    }

    // Process IQ samples to audio
    const iqSamples = this.iqBuffer.splice(0, blockSize);
    for (let i = 0; i < blockSize; i++) {
      const sample = iqSamples[i];
      if (!sample) {
        outputChannel[i] = 0;
        continue;
      }

      // Demodulate
      let audio = this.demodulate(sample);

      // Apply de-emphasis (for FM/WFM)
      if (
        this.deemphasisEnabled &&
        (this.demodType === DemodType.FM ||
          this.demodType === DemodType.NFM ||
          this.demodType === DemodType.WFM)
      ) {
        audio = this.applyDeemphasis(audio);
      }

      // Apply DC blocking
      audio = this.applyDCBlocker(audio);

      // Apply CW filter (for morse code)
      if (this.demodType === DemodType.CW) {
        audio = this.applyCWFilter(audio);
      }

      // Apply AGC
      if (this.agcMode !== AGCMode.OFF) {
        audio = this.applyAGC(audio);
      }

      // Apply squelch
      audio = this.applySquelch(audio);

      // Apply volume
      audio *= this.volume;

      // Clamp to valid range
      outputChannel[i] = Math.max(-1, Math.min(1, audio));
    }

    // Copy to all output channels (mono to stereo if needed)
    for (let ch = 1; ch < output.length; ch++) {
      output[ch]?.set(outputChannel);
    }

    return true; // Keep processor alive
  }

  /**
   * Demodulate IQ sample based on current demodulation type
   */
  private demodulate(sample: IQSample): number {
    switch (this.demodType) {
      case DemodType.AM:
        return this.demodulateAM(sample);
      case DemodType.FM:
      case DemodType.NFM:
      case DemodType.WFM:
        return this.demodulateFM(sample);
      case DemodType.USB:
        return this.demodulateUSB(sample);
      case DemodType.LSB:
        return this.demodulateLSB(sample);
      case DemodType.CW:
        return this.demodulateCW(sample);
      default:
        return 0;
    }
  }

  /**
   * AM demodulation - envelope detection
   */
  private demodulateAM(sample: IQSample): number {
    return Math.sqrt(sample.I * sample.I + sample.Q * sample.Q);
  }

  /**
   * FM demodulation - phase discrimination
   */
  private demodulateFM(sample: IQSample): number {
    const phase = Math.atan2(sample.Q, sample.I);
    let phaseDiff = phase - this.previousPhase;

    // Unwrap phase
    if (phaseDiff > Math.PI) {
      phaseDiff -= 2 * Math.PI;
    } else if (phaseDiff < -Math.PI) {
      phaseDiff += 2 * Math.PI;
    }

    this.previousPhase = phase;
    return phaseDiff / Math.PI;
  }

  /**
   * USB (Upper Sideband) demodulation
   */
  private demodulateUSB(sample: IQSample): number {
    // SSB: Use I channel and Hilbert transform of Q for sideband selection
    // USB: I + jH(Q), take real part
    const hilbertQ = this.applyHilbertTransform(sample.Q);
    return sample.I + hilbertQ;
  }

  /**
   * LSB (Lower Sideband) demodulation
   */
  private demodulateLSB(sample: IQSample): number {
    // LSB: I - jH(Q), take real part
    const hilbertQ = this.applyHilbertTransform(sample.Q);
    return sample.I - hilbertQ;
  }

  /**
   * CW (Continuous Wave) demodulation - for morse code
   */
  private demodulateCW(sample: IQSample): number {
    // CW: Envelope detection + tone generation at ~800 Hz
    // The actual tone is generated by the carrier offset
    return Math.sqrt(sample.I * sample.I + sample.Q * sample.Q);
  }

  /**
   * Apply Hilbert transform for SSB demodulation
   * Simple FIR approximation
   */
  private applyHilbertTransform(input: number): number {
    // Store input in circular buffer
    this.ssbHilbertBuffer[this.ssbHilbertIndex] = input;
    this.ssbHilbertIndex =
      (this.ssbHilbertIndex + 1) % this.ssbHilbertBuffer.length;

    // Simple Hilbert transform approximation using delay
    // For better quality, use proper Hilbert FIR coefficients
    const delayedSample =
      this.ssbHilbertBuffer[
        (this.ssbHilbertIndex + this.ssbHilbertBuffer.length / 2) %
          this.ssbHilbertBuffer.length
      ];
    return delayedSample ?? 0;
  }

  /**
   * Apply de-emphasis filter (IIR low-pass)
   */
  private applyDeemphasis(audio: number): number {
    this.deEmphasisState =
      this.deEmphasisAlpha * audio +
      (1 - this.deEmphasisAlpha) * this.deEmphasisState;
    return this.deEmphasisState;
  }

  /**
   * Apply DC blocking filter (IIR high-pass)
   */
  private applyDCBlocker(audio: number): number {
    const output =
      this.dcBlockerAlpha *
      (this.dcBlockerState + audio - this.dcBlockerPrevInput);
    this.dcBlockerState = output;
    this.dcBlockerPrevInput = audio;
    return output;
  }

  /**
   * Apply CW tone filter (for morse code readability)
   */
  private applyCWFilter(audio: number): number {
    this.cwFilterState =
      this.cwFilterAlpha * this.cwFilterState +
      (1 - this.cwFilterAlpha) * audio;
    return this.cwFilterState;
  }

  /**
   * Apply Automatic Gain Control
   */
  private applyAGC(audio: number): number {
    // Estimate RMS level
    const absAudio = Math.abs(audio);
    if (absAudio > this.agcRmsEstimate) {
      // Attack: fast response to increases
      this.agcRmsEstimate =
        this.agcAttackAlpha * this.agcRmsEstimate +
        (1 - this.agcAttackAlpha) * absAudio;
    } else {
      // Decay: slow response to decreases
      this.agcRmsEstimate =
        this.agcDecayAlpha * this.agcRmsEstimate +
        (1 - this.agcDecayAlpha) * absAudio;
    }

    // Calculate gain to reach target level
    if (this.agcRmsEstimate > 0.001) {
      const targetGain = this.agcTarget / this.agcRmsEstimate;
      // Limit gain range to prevent excessive amplification
      this.agcGain = Math.max(0.1, Math.min(10.0, targetGain));
    }

    return audio * this.agcGain;
  }

  /**
   * Apply squelch (noise gate)
   */
  private applySquelch(audio: number): number {
    // Estimate signal level
    const absAudio = Math.abs(audio);
    this.squelchRmsEstimate =
      this.squelchAlpha * this.squelchRmsEstimate +
      (1 - this.squelchAlpha) * absAudio;

    // Determine if squelch should be open or closed
    if (this.squelchRmsEstimate > this.squelchThreshold) {
      this.squelchOpen = true;
    } else if (this.squelchRmsEstimate < this.squelchThreshold * 0.7) {
      // Hysteresis: close at 70% of threshold to prevent chattering
      this.squelchOpen = false;
    }

    return this.squelchOpen ? audio : 0;
  }
}

// Register the processor
registerProcessor("audio-processor", AudioProcessor);
