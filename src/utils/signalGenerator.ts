/**
 * Test Signal Generator
 *
 * Utilities for generating synthetic IQ samples and test data for SDR testing.
 * This helps create deterministic, reproducible test data for DSP and visualization tests.
 */

export interface IQSampleOptions {
  /** Sample rate in Hz (e.g., 2048000) */
  sampleRate: number;
  /** Signal frequency in Hz (e.g., 100000) */
  frequency: number;
  /** Signal amplitude (0.0 to 1.0) */
  amplitude: number;
  /** Duration in seconds */
  duration: number;
  /** Phase offset in radians (default: 0) */
  phase?: number;
  /** Add noise (0.0 = no noise, 1.0 = full noise) */
  noiseLevel?: number;
}

export interface ComplexIQSamples {
  /** Interleaved I/Q samples [I0, Q0, I1, Q1, ...] */
  samples: Float32Array;
  /** Number of sample pairs */
  length: number;
  /** Sample rate in Hz */
  sampleRate: number;
}

/**
 * Generate sinusoidal IQ samples
 *
 * Creates a complex sinusoid at the specified frequency.
 * Useful for testing FFT, filtering, and visualization.
 *
 * @example
 * const samples = generateIQSamples({
 *   sampleRate: 2048000,
 *   frequency: 100000,
 *   amplitude: 0.8,
 *   duration: 0.1,
 * });
 */
export function generateIQSamples(options: IQSampleOptions): ComplexIQSamples {
  const {
    sampleRate,
    frequency,
    amplitude,
    duration,
    phase = 0,
    noiseLevel = 0,
  } = options;

  const numSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(numSamples * 2); // Interleaved I/Q

  const angularFreq = (2 * Math.PI * frequency) / sampleRate;

  for (let i = 0; i < numSamples; i++) {
    const angle = angularFreq * i + phase;

    // Generate I/Q pair
    let iValue = amplitude * Math.cos(angle);
    let qValue = amplitude * Math.sin(angle);

    // Add noise if specified
    if (noiseLevel > 0) {
      iValue += (Math.random() - 0.5) * 2 * noiseLevel;
      qValue += (Math.random() - 0.5) * 2 * noiseLevel;
    }

    samples[i * 2] = iValue;
    samples[i * 2 + 1] = qValue;
  }

  return {
    samples,
    length: numSamples,
    sampleRate,
  };
}

/**
 * Generate multi-tone IQ samples
 *
 * Creates multiple sinusoids at different frequencies.
 * Useful for testing frequency discrimination and channel separation.
 *
 * @example
 * const samples = generateMultiToneIQ({
 *   sampleRate: 2048000,
 *   tones: [
 *     { frequency: 100000, amplitude: 0.8 },
 *     { frequency: 200000, amplitude: 0.5 },
 *   ],
 *   duration: 0.1,
 * });
 */
export function generateMultiToneIQ(options: {
  sampleRate: number;
  tones: Array<{ frequency: number; amplitude: number; phase?: number }>;
  duration: number;
  noiseLevel?: number;
}): ComplexIQSamples {
  const { sampleRate, tones, duration, noiseLevel = 0 } = options;

  const numSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(numSamples * 2);

  for (let i = 0; i < numSamples; i++) {
    let iValue = 0;
    let qValue = 0;

    // Sum all tones
    for (const tone of tones) {
      const angularFreq = (2 * Math.PI * tone.frequency) / sampleRate;
      const angle = angularFreq * i + (tone.phase ?? 0);

      iValue += tone.amplitude * Math.cos(angle);
      qValue += tone.amplitude * Math.sin(angle);
    }

    // Add noise if specified
    if (noiseLevel > 0) {
      iValue += (Math.random() - 0.5) * 2 * noiseLevel;
      qValue += (Math.random() - 0.5) * 2 * noiseLevel;
    }

    samples[i * 2] = iValue;
    samples[i * 2 + 1] = qValue;
  }

  return {
    samples,
    length: numSamples,
    sampleRate,
  };
}

/**
 * Generate noise-only IQ samples
 *
 * Creates uniform random noise.
 * Useful for testing noise floor and signal detection.
 *
 * @example
 * const noise = generateNoiseIQ({
 *   sampleRate: 2048000,
 *   amplitude: 0.1,
 *   duration: 0.1,
 * });
 */
export function generateNoiseIQ(options: {
  sampleRate: number;
  amplitude: number;
  duration: number;
}): ComplexIQSamples {
  const { sampleRate, amplitude, duration } = options;

  const numSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(numSamples * 2);

  for (let i = 0; i < numSamples; i++) {
    samples[i * 2] = (Math.random() - 0.5) * 2 * amplitude;
    samples[i * 2 + 1] = (Math.random() - 0.5) * 2 * amplitude;
  }

  return {
    samples,
    length: numSamples,
    sampleRate,
  };
}

/**
 * Generate FM modulated IQ samples
 *
 * Creates an FM signal with a sinusoidal modulating signal.
 * Useful for testing FM demodulation.
 *
 * @example
 * const fmSignal = generateFMIQ({
 *   sampleRate: 2048000,
 *   carrierFreq: 100000,
 *   modulationFreq: 1000,
 *   deviation: 5000,
 *   amplitude: 0.8,
 *   duration: 0.1,
 * });
 */
export function generateFMIQ(options: {
  sampleRate: number;
  carrierFreq: number;
  modulationFreq: number;
  deviation: number;
  amplitude: number;
  duration: number;
  noiseLevel?: number;
}): ComplexIQSamples {
  const {
    sampleRate,
    carrierFreq,
    modulationFreq,
    deviation,
    amplitude,
    duration,
    noiseLevel = 0,
  } = options;

  const numSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(numSamples * 2);

  const carrierAngularFreq = (2 * Math.PI * carrierFreq) / sampleRate;
  const modAngularFreq = (2 * Math.PI * modulationFreq) / sampleRate;
  const devRatio = deviation / sampleRate;

  for (let i = 0; i < numSamples; i++) {
    // FM: frequency varies with modulating signal
    const modulatingSignal = Math.sin(modAngularFreq * i);
    const instantaneousPhase =
      carrierAngularFreq * i + 2 * Math.PI * devRatio * modulatingSignal * i;

    let iValue = amplitude * Math.cos(instantaneousPhase);
    let qValue = amplitude * Math.sin(instantaneousPhase);

    // Add noise if specified
    if (noiseLevel > 0) {
      iValue += (Math.random() - 0.5) * 2 * noiseLevel;
      qValue += (Math.random() - 0.5) * 2 * noiseLevel;
    }

    samples[i * 2] = iValue;
    samples[i * 2 + 1] = qValue;
  }

  return {
    samples,
    length: numSamples,
    sampleRate,
  };
}

/**
 * Generate FM-stereo IQ with an RDS BPSK subcarrier.
 *
 * This is a simplified composite FM generator intended for tests. It creates
 * mono L/R audio tones, constructs L+R and L-R channels for stereo, inserts a
 * 19kHz pilot tone and a 38kHz DSB suppressed carrier for stereo, and adds a
 * 57kHz BPSK RDS subcarrier carrying a simple repeating bit pattern.
 */
export function generateFMStereoWithRDSIQ(options: {
  sampleRate: number;
  carrierFreq: number; // center carrier frequency of the FM signal
  audioFreqLeft: number; // frequency of left channel audio tone
  audioFreqRight: number; // frequency of right channel audio tone
  deviation: number;
  amplitude: number;
  duration: number;
  noiseLevel?: number;
}): ComplexIQSamples {
  const {
    sampleRate,
    carrierFreq,
    audioFreqLeft,
    audioFreqRight,
    deviation,
    amplitude,
    duration,
    noiseLevel = 0,
  } = options;

  const numSamples = Math.floor(sampleRate * duration);
  const out = new Float32Array(numSamples * 2);

  // Audio (baseband) samples
  // stereo: L+R (mono) baseband, and L-R modulated onto 38kHz DSB suppressed.
  const pilotFreq = 19000; // 19 kHz pilot tone
  const stereoCarrierFreq = 38000; // 38 kHz suppressed carrier
  const rdsSubcarrierFreq = 57000; // 57 kHz RDS subcarrier
  const rdsBitRate = 1187.5; // bits per second for RDS

  // We will approximate a simple RDS bit pattern using BPSK (diff. is not simulated)
  const rdsPattern = new Array(64)
    .fill(0)
    .map((_, i) => (i % 2 === 0 ? 1 : -1)); // basic alternating pattern

  // Phase accumulators
  let carrierPhase = 0;

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;

    // generate left and right audio tones
    const leftSample = Math.sin(2 * Math.PI * audioFreqLeft * t);
    const rightSample = Math.sin(2 * Math.PI * audioFreqRight * t);

    const lPlusR = (leftSample + rightSample) / 2; // baseband mono
    const lMinusR = (leftSample - rightSample) / 2; // stereo difference

    // Stereo: DSB-SC at 38kHz for L-R
    const stereoDSB = lMinusR * Math.cos(2 * Math.PI * stereoCarrierFreq * t);

    // 19kHz pilot tone (small amplitude)
    const pilot = 0.1 * Math.cos(2 * Math.PI * pilotFreq * t);

    // RDS BPSK: choose bit from pattern using bit rate
    const bitIdx = Math.floor(t * rdsBitRate) % rdsPattern.length;
    const rdsBit = rdsPattern[bitIdx] ?? 1;
    const rdsCarrier = rdsBit * Math.cos(2 * Math.PI * rdsSubcarrierFreq * t);

    // Composite baseband (mono + stereo DSB + pilot + rds)
    const composite = lPlusR + stereoDSB + pilot + 0.05 * rdsCarrier;

    // FM frequency deviation proportional to composite
    const instantaneousFreq = carrierFreq + deviation * composite;
    carrierPhase += (2 * Math.PI * instantaneousFreq) / sampleRate;

    let iValue = amplitude * Math.cos(carrierPhase);
    let qValue = amplitude * Math.sin(carrierPhase);

    if (noiseLevel > 0) {
      iValue += (Math.random() - 0.5) * 2 * noiseLevel;
      qValue += (Math.random() - 0.5) * 2 * noiseLevel;
    }

    out[i * 2] = iValue;
    out[i * 2 + 1] = qValue;
  }

  return { samples: out, length: numSamples, sampleRate };
}

/**
 * Generate AM modulated IQ samples
 *
 * Creates an AM signal with a sinusoidal modulating signal.
 * Useful for testing AM demodulation.
 *
 * @example
 * const amSignal = generateAMIQ({
 *   sampleRate: 2048000,
 *   carrierFreq: 100000,
 *   modulationFreq: 1000,
 *   modulationDepth: 0.5,
 *   amplitude: 0.8,
 *   duration: 0.1,
 * });
 */
export function generateAMIQ(options: {
  sampleRate: number;
  carrierFreq: number;
  modulationFreq: number;
  modulationDepth: number;
  amplitude: number;
  duration: number;
  noiseLevel?: number;
}): ComplexIQSamples {
  const {
    sampleRate,
    carrierFreq,
    modulationFreq,
    modulationDepth,
    amplitude,
    duration,
    noiseLevel = 0,
  } = options;

  const numSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(numSamples * 2);

  const carrierAngularFreq = (2 * Math.PI * carrierFreq) / sampleRate;
  const modAngularFreq = (2 * Math.PI * modulationFreq) / sampleRate;

  for (let i = 0; i < numSamples; i++) {
    // AM: amplitude varies with modulating signal
    const modulatingSignal = Math.sin(modAngularFreq * i);
    const envelope = amplitude * (1 + modulationDepth * modulatingSignal);

    const angle = carrierAngularFreq * i;

    let iValue = envelope * Math.cos(angle);
    let qValue = envelope * Math.sin(angle);

    // Add noise if specified
    if (noiseLevel > 0) {
      iValue += (Math.random() - 0.5) * 2 * noiseLevel;
      qValue += (Math.random() - 0.5) * 2 * noiseLevel;
    }

    samples[i * 2] = iValue;
    samples[i * 2 + 1] = qValue;
  }

  return {
    samples,
    length: numSamples,
    sampleRate,
  };
}

/**
 * Generate chirp signal (linear frequency sweep)
 *
 * Creates a signal that sweeps from startFreq to endFreq.
 * Useful for testing frequency analysis and time-frequency representations.
 *
 * @example
 * const chirp = generateChirpIQ({
 *   sampleRate: 2048000,
 *   startFreq: 50000,
 *   endFreq: 150000,
 *   amplitude: 0.8,
 *   duration: 0.1,
 * });
 */
export function generateChirpIQ(options: {
  sampleRate: number;
  startFreq: number;
  endFreq: number;
  amplitude: number;
  duration: number;
  noiseLevel?: number;
}): ComplexIQSamples {
  const {
    sampleRate,
    startFreq,
    endFreq,
    amplitude,
    duration,
    noiseLevel = 0,
  } = options;

  const numSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(numSamples * 2);

  const freqRate = (endFreq - startFreq) / (numSamples - 1);
  let phase = 0;

  for (let i = 0; i < numSamples; i++) {
    const instantaneousFreq = startFreq + freqRate * i;
    const angularFreq = (2 * Math.PI * instantaneousFreq) / sampleRate;

    phase += angularFreq;

    let iValue = amplitude * Math.cos(phase);
    let qValue = amplitude * Math.sin(phase);

    // Add noise if specified
    if (noiseLevel > 0) {
      iValue += (Math.random() - 0.5) * 2 * noiseLevel;
      qValue += (Math.random() - 0.5) * 2 * noiseLevel;
    }

    samples[i * 2] = iValue;
    samples[i * 2 + 1] = qValue;
  }

  return {
    samples,
    length: numSamples,
    sampleRate,
  };
}

/**
 * Calculate signal-to-noise ratio (SNR) from IQ samples
 *
 * Useful for validating signal quality in tests.
 *
 * @example
 * const snr = calculateSNR(samples.samples, 100000, 2048000);
 * expect(snr).toBeGreaterThan(20); // Expect >20 dB SNR
 */
export function calculateSNR(
  samples: Float32Array,
  signalFreq: number,
  sampleRate: number,
): number {
  const numSamples = samples.length / 2;

  // Calculate power at signal frequency bin
  let signalI = 0;
  let signalQ = 0;
  let noiseI = 0;
  let noiseQ = 0;

  const angularFreq = (2 * Math.PI * signalFreq) / sampleRate;

  for (let i = 0; i < numSamples; i++) {
    const iSample = samples[i * 2];
    const qSample = samples[i * 2 + 1];

    if (iSample === undefined || qSample === undefined) {
      continue;
    }

    const expectedI = Math.cos(angularFreq * i);
    const expectedQ = Math.sin(angularFreq * i);

    signalI += iSample * expectedI;
    signalQ += qSample * expectedQ;

    noiseI += iSample - expectedI;
    noiseQ += qSample - expectedQ;
  }

  const signalPower = (signalI * signalI + signalQ * signalQ) / numSamples;
  const noisePower = (noiseI * noiseI + noiseQ * noiseQ) / numSamples;

  return 10 * Math.log10(signalPower / noisePower);
}
