import { describe, it, expect } from 'vitest';
import { ComplexOscillator } from './ComplexOscillator';

describe('ComplexOscillator', () => {
    it('should rotate a DC signal (shift frequency)', () => {
        const sampleRate = 1000;
        const targetFreq = 250; // Shift by Fs/4 (90 degrees per sample)
        const nco = new ComplexOscillator(sampleRate);
        nco.setFrequency(targetFreq, sampleRate);

        // Input: DC Signal (I=1, Q=0) at "0 Hz"
        const input = new Int8Array(8); // 4 samples
        input.fill(0);
        for(let i=0; i<4; i++) input[2*i] = 100; // I=100

        const output = new Float32Array(8);
        nco.mix(input, output);

        // Expected Mixing:
        // Sample 0: phase=0   -> e^-j0 = 1       -> (100, 0) * 1 = (100, 0)
        // Sample 1: phase=90  -> e^-j90 = -j     -> (100, 0) * -j = (0, -100)
        // Sample 2: phase=180 -> e^-j180 = -1    -> (100, 0) * -1 = (-100, 0)
        // Sample 3: phase=270 -> e^-j270 = j     -> (100, 0) * j = (0, 100)

        expect(output[0]).toBeCloseTo(100);
        expect(output[1]).toBeCloseTo(0);

        expect(output[2]).toBeCloseTo(0);
        expect(output[3]).toBeCloseTo(-100);

        expect(output[4]).toBeCloseTo(-100);
        expect(output[5]).toBeCloseTo(0);

        expect(output[6]).toBeCloseTo(0);
        expect(output[7]).toBeCloseTo(100);
    });
});
