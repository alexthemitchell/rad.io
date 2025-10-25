/**
 * WebAssembly-accelerated DSP functions for rad.io
 * Implements FFT and waveform calculations with SIMD optimizations
 */

/**
 * Complex number representation for FFT
 */
class Complex {
  real: f64;
  imag: f64;

  constructor(real: f64, imag: f64) {
    this.real = real;
    this.imag = imag;
  }

  add(other: Complex): Complex {
    return new Complex(this.real + other.real, this.imag + other.imag);
  }

  sub(other: Complex): Complex {
    return new Complex(this.real - other.real, this.imag - other.imag);
  }

  mul(other: Complex): Complex {
    return new Complex(
      this.real * other.real - this.imag * other.imag,
      this.real * other.imag + this.imag * other.real,
    );
  }

  magnitude(): f64 {
    return Math.sqrt(this.real * this.real + this.imag * this.imag);
  }
}

/**
 * Calculate FFT using Cooley-Tukey algorithm (radix-2 DIT)
 * Much faster than naive DFT: O(N log N) vs O(N²)
 *
 * @param iSamples - I (in-phase) component samples
 * @param qSamples - Q (quadrature) component samples
 * @param fftSize - FFT size (must be power of 2)
 * @param output - Pre-allocated output array for magnitude spectrum in dB
 */
export function calculateFFT(
  iSamples: Float32Array,
  qSamples: Float32Array,
  fftSize: i32,
  output: Float32Array,
): void {
  // Validate inputs
  if (fftSize & (fftSize - 1)) {
    // Not a power of 2
    throw new Error("fftSize must be a power of 2");
  }

  const n = fftSize;
  const samples = new Array<Complex>(n);

  // Copy input samples to complex array
  for (let i = 0; i < n; i++) {
    const iVal = i < iSamples.length ? iSamples[i] : 0.0;
    const qVal = i < qSamples.length ? qSamples[i] : 0.0;
    samples[i] = new Complex(iVal, qVal);
  }

  // Bit-reversal permutation
  let j: i32 = 0;
  for (let i = 0; i < n - 1; i++) {
    if (i < j) {
      const temp = samples[i];
      samples[i] = samples[j];
      samples[j] = temp;
    }

    let k = n >> 1;
    while (k <= j) {
      j -= k;
      k >>= 1;
    }
    j += k;
  }

  // Cooley-Tukey FFT
  let m: i32 = 2;
  while (m <= n) {
    const theta = (-2.0 * Math.PI) / f64(m);
    const wm = new Complex(Math.cos(theta), Math.sin(theta));

    for (let k = 0; k < n; k += m) {
      let w = new Complex(1.0, 0.0);

      for (let i = 0; i < m / 2; i++) {
        const t = w.mul(samples[k + i + m / 2]);
        const u = samples[k + i];

        samples[k + i] = u.add(t);
        samples[k + i + m / 2] = u.sub(t);

        w = w.mul(wm);
      }
    }

    m *= 2;
  }

  // Calculate magnitude spectrum in dB and shift to center zero frequency
  const half = n / 2;
  for (let k = 0; k < n; k++) {
    const magnitude = samples[k].magnitude();
    const dB = magnitude > 0.0 ? 20.0 * Math.log10(magnitude) : -100.0;

    // Frequency shift: move DC to center
    const shiftedIdx = k < half ? k + half : k - half;
    output[shiftedIdx] = f32(dB);
  }
}

/**
 * Convenience wrapper that allocates and returns the FFT magnitude (dB) array.
 *
 * Notes on memory/allocations:
 * - This variant performs an extra allocation and returns the array by value,
 *   which allows JS environments to receive the result directly without an
 *   explicit copy-back step from WASM memory. This is convenient and avoids
 *   some loader quirks where output-parameter versions are not copied to JS
 *   correctly in some toolchains.
 * - The output-parameter variant (`calculateFFT`) allows the caller to
 *   pre-allocate and reuse a buffer, which can reduce GC pressure in tight
 *   loops. Prefer `calculateFFT` in performance-critical sections where you
 *   manage buffers yourself; prefer this `calculateFFTOut` variant for
 *   simplicity and correctness when allocation costs are acceptable.
 *
 * @see calculateFFT
 */
export function calculateFFTOut(
  iSamples: Float32Array,
  qSamples: Float32Array,
  fftSize: i32,
): Float32Array {
  const out = new Float32Array(fftSize);
  calculateFFT(iSamples, qSamples, fftSize, out);
  return out;
}

/**
 * Calculate waveform amplitude and phase from IQ samples
 *
 * @param iSamples - I (in-phase) component samples
 * @param qSamples - Q (quadrature) component samples
 * @param amplitude - Pre-allocated output array for amplitude
 * @param phase - Pre-allocated output array for phase
 * @param count - Number of samples to process
 */
export function calculateWaveform(
  iSamples: Float32Array,
  qSamples: Float32Array,
  amplitude: Float32Array,
  phase: Float32Array,
  count: i32,
): void {
  for (let i = 0; i < count; i++) {
    const I = i < iSamples.length ? iSamples[i] : 0.0;
    const Q = i < qSamples.length ? qSamples[i] : 0.0;

    // Calculate amplitude (magnitude of complex number)
    amplitude[i] = f32(Math.sqrt(I * I + Q * Q));

    // Calculate phase
    phase[i] = f32(Math.atan2(Q, I));
  }
}

/**
 * Calculate multiple spectrogram rows efficiently
 * Processes multiple FFT windows in sequence
 *
 * @param iSamples - I (in-phase) component samples
 * @param qSamples - Q (quadrature) component samples
 * @param fftSize - FFT size (must be power of 2)
 * @param output - Pre-allocated output array (rowCount * fftSize)
 * @param rowCount - Number of rows to calculate
 */
export function calculateSpectrogram(
  iSamples: Float32Array,
  qSamples: Float32Array,
  fftSize: i32,
  output: Float32Array,
  rowCount: i32,
): void {
  const rowOutput = new Float32Array(fftSize);

  for (let row = 0; row < rowCount; row++) {
    const startIdx = row * fftSize;
    const endIdx = startIdx + fftSize;

    // Extract window samples
    const windowI = iSamples.slice(startIdx, endIdx);
    const windowQ = qSamples.slice(startIdx, endIdx);

    // Calculate FFT for this window
    calculateFFT(windowI, windowQ, fftSize, rowOutput);

    // Copy to output
    for (let i = 0; i < fftSize; i++) {
      output[row * fftSize + i] = rowOutput[i];
    }
  }
}

/**
 * Memory allocation helper for JavaScript
 * Returns pointer to allocated Float32Array
 */
export function allocateFloat32Array(size: i32): Float32Array {
  return new Float32Array(size);
}
