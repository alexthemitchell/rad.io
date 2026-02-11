import { describe, it, expect } from 'vitest';
import { SimpleFFT } from './fft';

describe('SimpleFFT', () => {
  it('should detect a sine wave peak', () => {
    const size = 1024;
    const fft = new SimpleFFT(size);
    const input = new Float32Array(size * 2); // IQ interleaved
    const output = new Float32Array(size * 2); // Complex output

    // Generate a sine wave at bin 10
    // Frequency = 10 cycles per window
    for (let i = 0; i < size; i++) {
        const theta = (i / size) * Math.PI * 2 * 10;
        input[i * 2] = Math.cos(theta); // I (Real)
        input[i * 2 + 1] = Math.sin(theta); // Q (Imag)
    }

    fft.transform(output, input);

    // Calculate magnitudes
    const mags = new Float32Array(size);
    let maxBin = 0;
    let maxVal = 0;

    for(let i=0; i<size; i++) {
        const r = output[i*2];
        const im = output[i*2+1];
        const mag = Math.sqrt(r*r + im*im);
        mags[i] = mag;
        if (mag > maxVal) {
            maxVal = mag;
            maxBin = i;
        }
    }

    // Peak should be at bin 10
    expect(maxBin).toBe(10);
    // Magnitude should be roughly proportional to size (scaling varies by impl)
    expect(maxVal).toBeGreaterThan(100);
  });
});
