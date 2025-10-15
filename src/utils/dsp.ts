import webfft from "webfft";

export type Sample = {
  I: number;
  Q: number;
};

/**
 * Calculate a single row of spectrogram data using FFT
 */
export function calculateSpectrogramRow(
  samples: Sample[],
  fftSize: number,
): Float32Array {
  // Interleave samples as float32
  const interleavedSamples: number[] = samples.flatMap((sample) => [
    sample.I,
    sample.Q,
  ]);

  const input = new Float32Array(interleavedSamples);

  // Apply FFT
  const fft = new webfft(fftSize);
  const out = fft.fft(input);

  // Shift FFT - move zero frequency to center
  const middleElementIndex = out.length / 2;
  const positiveFrequencies = out.slice(0, middleElementIndex);
  const negativeFrequencies = out.slice(middleElementIndex);
  const shiftedFFT = new Float32Array(out.length);
  shiftedFFT.set(negativeFrequencies);
  shiftedFFT.set(positiveFrequencies, negativeFrequencies.length);

  // Take absolute values
  const absolutedValues = shiftedFFT.map(Math.abs);

  // Square
  const squaredValues = absolutedValues.map((val) => val ** 2);

  // Convert values to dB (10 * log10(power))
  const logValues = squaredValues.map(Math.log10);
  const amplifiedValues = logValues.map((val) => val * 10);

  return amplifiedValues;
}

/**
 * Calculate full spectrogram from sample data
 */
export function calculateSpectrogram(
  samples: Sample[],
  fftSize: number,
): Float32Array[] {
  const rowCount = Math.floor(samples.length / fftSize);
  const spectrogramData: Float32Array[] = [];

  for (let i = 0; i < rowCount; i++) {
    const startIndex = i * fftSize;
    const endIndex = startIndex + fftSize;
    const rowSamples = samples.slice(startIndex, endIndex);
    const row = calculateSpectrogramRow(rowSamples, fftSize);
    spectrogramData.push(row);
  }

  return spectrogramData;
}

/**
 * Convert raw IQ samples to Sample objects
 */
export function convertToSamples(
  rawSamples: [number, number][],
): Sample[] {
  return rawSamples.map(([i, q]) => {
    if (i === undefined || q === undefined) {
      throw new Error("invalid sample");
    }
    return { I: i, Q: q };
  });
}
