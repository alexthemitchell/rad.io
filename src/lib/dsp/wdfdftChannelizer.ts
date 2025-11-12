/**
 * Windowed DFT Channelizer (lightweight polyphase approximation)
 *
 * This module implements a simple channelizer based on applying a window to
 * non-overlapping blocks of M samples and computing an M-point complex DFT.
 * Each DFT bin corresponds to a frequency subband which is decimated by M.
 *
 * It is intended as a pragmatic first step toward a full polyphase filterbank
 * (PFB). It gives reasonable frequency isolation for FM subbands at much
 * lower implementation complexity.
 */
import type { IQSample } from "../../models/SDRDevice";

// Small DFT implementation that operates on complex input
function computeDFTComplex(input: IQSample[]): {
  real: Float32Array;
  imag: Float32Array;
} {
  const len = input.length;
  const real = new Float32Array(len);
  const imag = new Float32Array(len);
  for (let k = 0; k < len; k++) {
    let r = 0;
    let i = 0;
    for (let n = 0; n < len; n++) {
      const angle = (-2 * Math.PI * k * n) / len;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const s = input[n] ?? { I: 0, Q: 0 };
      r += s.I * cos - s.Q * sin;
      i += s.I * sin + s.Q * cos;
    }
    real[k] = r;
    imag[k] = i;
  }
  return { real, imag };
}

function hammingWindow(len: number): Float32Array {
  const w = new Float32Array(len);
  for (let n = 0; n < len; n++) {
    w[n] = 0.54 - 0.46 * Math.cos((2 * Math.PI * n) / (len - 1));
  }
  return w;
}

/**
 * Channelize the input IQ samples into M uniform subbands using a
 * windowed DFT approach. Returns a Map from subband index to decimated
 * IQ sample array for that subband.
 *
 * @param samples - Wideband IQ samples
 * @param sampleRate - Sample rate in Hz
 * @param centerFrequency - Capture center frequency in Hz
 * @param channelBandwidth - Target channel bandwidth in Hz (approx.)
 * @param requestedFrequencies - Array of requested channel center freqs (Hz)
 */
export function windowedDFTChannelize(
  samples: IQSample[],
  sampleRate: number,
  centerFrequency: number,
  channelBandwidth: number,
  requestedFrequencies: number[],
): Map<number, IQSample[]> {
  if (samples.length === 0) return new Map();

  // Determine number of subbands (M)
  const M = Math.max(1, Math.round(sampleRate / channelBandwidth));
  const blockSize = M; // non-overlapping blocks of size M
  const binWidth = sampleRate / M;

  // Build Hamming window for the block
  const window = hammingWindow(blockSize);

  // Map requested frequencies -> bin index
  const freqToBin = new Map<number, number>();
  for (const f of requestedFrequencies) {
    const offset = f - centerFrequency; // signed offset
    const binFloat = offset / binWidth + M / 2; // map to 0..M-1
    let bin = Math.round(binFloat);
    if (bin < 0) bin = 0;
    if (bin >= M) bin = M - 1;
    freqToBin.set(f, bin);
  }

  // Prepare per-bin output buffers
  const outputs = new Map<number, IQSample[]>();
  for (const f of requestedFrequencies) {
    outputs.set(f, []);
  }

  // Slide over non-overlapping blocks
  const blocks = Math.floor(samples.length / blockSize);
  for (let b = 0; b < blocks; b++) {
    const offset = b * blockSize;
    const block = new Array<IQSample>(blockSize);
    for (let n = 0; n < blockSize; n++) {
      const s = samples[offset + n];
      const w = window[n] ?? 1;
      if (s) {
        block[n] = { I: s.I * w, Q: s.Q * w };
      } else {
        block[n] = { I: 0, Q: 0 };
      }
    }

    // Compute DFT for this block
    const { real, imag } = computeDFTComplex(block);

    // For each requested frequency, pick its bin and append the complex value
    for (const [f, bin] of freqToBin.entries()) {
      const r = real[bin] ?? 0;
      const i = imag[bin] ?? 0;
      const buf = outputs.get(f);
      if (!buf) continue;
      buf.push({ I: r, Q: i });
    }
  }

  return outputs;
}
