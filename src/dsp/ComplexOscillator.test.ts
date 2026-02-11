import { describe, it, expect } from 'vitest';
import { ComplexOscillator } from './ComplexOscillator';

describe('ComplexOscillator', () => {
    it('generates mixing values', () => {
        const nco = new ComplexOscillator(100);
        nco.setFrequency(25, 100); // 25Hz at 100Hz = pi/2 per step
        
        const input = new Int8Array([100, 0, 100, 0]); // DC signal (I=100, Q=0)
        const output = new Float32Array(4);
        
        nco.mix(input, output);
        
        // n=0: exp(-j0) = 1. Out = 100 * 1 = 100 + j0
        expect(output[0]).toBeCloseTo(100, 1);
        expect(output[1]).toBeCloseTo(0, 1);
        
        // n=1: exp(-j*pi/2) = -j. Out = 100 * (-j) = 0 - j100
        expect(output[2]).toBeCloseTo(0, 1);
        expect(output[3]).toBeCloseTo(-100, 1);
    });
});
