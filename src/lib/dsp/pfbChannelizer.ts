/**
 * Polyphase Filter Bank (PFB) Channelizer
 *
 * A pragmatic PFB implementation suitable for unit tests and development.
 * It splits the prototype filter into M polyphase branches, applies each
 * branch to the incoming complex IQ stream, and performs an M-point DFT
 * across the branch outputs producing decimated subband complex samples at
 * sampleRate / M.
 */
import { fftWorkerPool } from "./fft-worker-pool";
import type { IQSample } from "../../models/SDRDevice";
// Small trig cache for repeated tiny DFTs (avoid repeated Math.cos/sin)
const dftTrigCache = new Map<
  number,
  { cos: Float32Array; sin: Float32Array }
>();

export interface PFBChannelizerOptions {
  tapsPerPhase?: number; // Number of taps per polyphase branch (defaults to 8)
  useWorker?: boolean; // Allow tests/consumers to disable worker usage
  workerThreshold?: number; // Minimum numPhases required to use worker
}

// Build a Hamming-windowed sinc prototype filter of length L = M * tapsPerPhase
function designPrototypeFilter(
  numPhases: number,
  tapsPerPhase: number,
  cutoffHz: number,
  sampleRate: number,
): Float32Array {
  const L = numPhases * tapsPerPhase;
  const fc = cutoffHz / sampleRate; // normalized cutoff (0..0.5)
  const coeffs = new Float32Array(L);
  const Mminus1 = L - 1;
  for (let i = 0; i < L; i++) {
    const m = i - Mminus1 / 2;
    let sinc = 0;
    if (m === 0) {
      sinc = 2 * fc;
    } else {
      sinc = Math.sin(2 * Math.PI * fc * m) / (Math.PI * m);
    }
    // Hamming window
    const w = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / Mminus1);
    coeffs[i] = sinc * w;
  }
  // Normalize
  let sum = 0;
  for (const v of coeffs) sum += v;
  if (sum === 0) sum = 1;
  for (let i = 0; i < coeffs.length; i++) coeffs[i] = (coeffs[i] ?? 0) / sum;
  return coeffs;
}

// Naive complex DFT for small M sizes (M is small; performance is OK for tests)
function complexDFT(
  input: Array<{ re: number; im: number }>,
): Array<{ re: number; im: number }> {
  const N = input.length;
  if (!dftTrigCache.has(N)) {
    const cos = new Float32Array(N);
    const sin = new Float32Array(N);
    for (let k = 0; k < N; k++) {
      const angle = (-2 * Math.PI * k) / N;
      cos[k] = Math.cos(angle);
      sin[k] = Math.sin(angle);
    }
    dftTrigCache.set(N, { cos, sin });
  }
  const cached = dftTrigCache.get(N);
  if (!cached) throw new Error(`missing trig for DFT size ${N}`);
  const { cos: cosTable, sin: sinTable } = cached;
  const out: Array<{ re: number; im: number }> = new Array(N)
    .fill(0)
    .map(() => ({ re: 0, im: 0 }));
  for (let k = 0; k < N; k++) {
    let re = 0;
    let im = 0;
    for (let n = 0; n < N; n++) {
      const idx = (k * n) % N;
      const c = cosTable[idx] ?? 0;
      const s = sinTable[idx] ?? 0;
      const sample = input[n] ?? { re: 0, im: 0 };
      const xr = sample.re;
      const xi = sample.im;
      re += xr * c - xi * s;
      im += xr * s + xi * c;
    }
    out[k] = { re, im };
  }
  return out;
}

/**
 * PFB channelize: returns a Map of channel center frequency -> decimated IQ array
 * (each IQ pair is {I,Q}), sample rate after decimation is sampleRate / M
 */
export async function pfbChannelize(
  samples: IQSample[],
  sampleRate: number,
  centerFrequency: number,
  channelBandwidth: number,
  channelCenterFreqs: number[],
  opts: PFBChannelizerOptions = {},
): Promise<Map<number, IQSample[]>> {
  const tapsPerPhase = Math.max(2, Math.floor(opts.tapsPerPhase ?? 8));
  const numPhases = Math.max(1, Math.round(sampleRate / channelBandwidth));
  // If M is 1 then pfb degenerates to direct filtering + decimate
  if (numPhases === 1) {
    // trivial: copy and decimate to 1: simple pass-through
    const out = new Map<number, IQSample[]>();
    for (const f of channelCenterFreqs) out.set(f, samples.slice());
    return out;
  }

  const prototypeLen = numPhases * tapsPerPhase;
  const cutoffHz = channelBandwidth / 2; // Low-pass cutoff for prototype
  const prototype = designPrototypeFilter(
    numPhases,
    tapsPerPhase,
    cutoffHz,
    sampleRate,
  );

  // Build polyphase coefficients: poly[p][k] = prototype[k*numPhases + p]
  const poly: number[][] = [];
  for (let p = 0; p < numPhases; p++) {
    poly.push(new Array<number>(tapsPerPhase).fill(0));
  }
  for (let p = 0; p < numPhases; p++) {
    for (let k = 0; k < tapsPerPhase; k++) {
      const idx = k * numPhases + p;
      let polyRow = poly[p];
      if (!polyRow) {
        polyRow = new Array<number>(tapsPerPhase).fill(0);
        poly[p] = polyRow;
      }
      polyRow[k] =
        idx >= 0 && idx < prototype.length ? (prototype[idx] ?? 0) : 0;
    }
  }

  // We'll maintain a circular buffer of last prototypeLen IQ samples
  const buffer: IQSample[] = Array.from({ length: prototypeLen }, () => ({
    I: 0,
    Q: 0,
  }));
  let bufIndex = 0; // points to oldest sample

  // Prepare output per channel
  const outputs = new Map<number, IQSample[]>();
  for (const f of channelCenterFreqs) outputs.set(f, []);

  // Map each requested channel center to a PFB bin index
  const binWidth = sampleRate / numPhases; // Frequency per PFB bin
  // Use integer midpoint for bin mapping
  const half = Math.floor(numPhases / 2);
  const channelToBin = new Map<number, number>();
  for (const f of channelCenterFreqs) {
    // compute offset from center in bins (integer bin index)
    const offsetHz = f - centerFrequency;
    const binOffset = Math.round(offsetHz / binWidth);
    const binIdx = (((binOffset + half) % numPhases) + numPhases) % numPhases;
    channelToBin.set(f, binIdx);
  }

  // Process input in blocks of M samples (typical implementation)
  for (let i = 0; i < samples.length; i++) {
    // Write sample into buffer (overwrite oldest)
    buffer[bufIndex] = samples[i] ?? { I: 0, Q: 0 };
    bufIndex = (bufIndex + 1) % prototypeLen;

    // Only produce output once we've had at least prototypeLen samples and at a block boundary
    if (i >= prototypeLen - 1 && (i + 1) % numPhases === 0) {
      // For each phase p, compute filtered branch output: y[p] = sum_{k=0..tapsPerPhase-1} poly[p][k] * x[n - (k*M + p)]
      const branchOut: Array<{ re: number; im: number }> = Array.from(
        { length: numPhases },
        () => ({ re: 0, im: 0 }),
      );
      for (let p = 0; p < numPhases; p++) {
        let accRe = 0;
        let accIm = 0;
        for (let k = 0; k < tapsPerPhase; k++) {
          const idx =
            (bufIndex - 1 - (k * numPhases + p) + prototypeLen) % prototypeLen;
          const s = buffer[idx] ?? { I: 0, Q: 0 };
          const coeff = poly[p]?.[k] ?? 0;
          accRe += s.I * coeff;
          accIm += s.Q * coeff; // coefficients are real -> apply independently
        }
        branchOut[p] = { re: accRe, im: accIm };
      }

      // Compute M-point DFT across branchOut to produce subbands
      // Use FFT worker pool for better performance when available and M >= threshold
      const workerEnabled = opts.useWorker ?? true;
      const workerThreshold = opts.workerThreshold ?? 8; // Use worker for M >= 8 by default
      const useWorker =
        workerEnabled &&
        typeof fftWorkerPool !== "undefined" &&
        fftWorkerPool.getWorkerLoads().length > 0;
      let bins: Array<{ re: number; im: number }> = [];
      if (useWorker && numPhases >= workerThreshold) {
        try {
          // Convert branchOut (complex) into interleaved Float32Array (I, Q pairs)
          const interleaved = new Float32Array(numPhases * 2);
          for (let k = 0; k < numPhases; k++) {
            interleaved[k * 2] = branchOut[k]?.re ?? 0;
            interleaved[k * 2 + 1] = branchOut[k]?.im ?? 0;
          }

          // Ask the worker pool to compute FFT with size numPhases
          const fftRes = await fftWorkerPool.computeFFT(
            interleaved,
            sampleRate,
            0,
            numPhases,
          );

          const phases = fftRes.phase ?? new Float32Array(0);
          const magsDb = fftRes.magnitude;
          const MIN_LINEAR = 1e-10;
          const N = Math.min(phases.length, magsDb.length, numPhases);
          bins = new Array(N).fill(0).map(() => ({ re: 0, im: 0 }));
          for (let k = 0; k < N; k++) {
            const db = magsDb[k] ?? -200;
            const linear = Math.pow(10, db / 20) || MIN_LINEAR;
            const ph = phases[k] ?? 0;
            bins[k] = { re: linear * Math.cos(ph), im: linear * Math.sin(ph) };
          }
        } catch {
          // Fall back to local DFT if worker fails
          bins = complexDFT(branchOut);
        }
      } else {
        bins = complexDFT(branchOut);
      }

      // Append selected bins to each channel's decimated stream as IQSample
      for (const [f, binIdx] of channelToBin.entries()) {
        const b = bins[binIdx];
        if (!b) continue;
        // Convert back to IQ: treat re->I and im->Q
        const iq: IQSample = { I: b.re, Q: b.im };
        const arr = outputs.get(f);
        arr?.push(iq);
      }
    }
  }

  return outputs;
}

export default pfbChannelize;
