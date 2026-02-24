import { describe, it, expect } from 'vitest';
import { Downsampler } from './Downsampler';

describe('Downsampler', () => {
    it('should reduce sample count by factor 40', () => {
        const downsampler = new Downsampler();
        const inputSize = 4000;
        const input = new Float32Array(inputSize);
        
        // Process
        const output = downsampler.process(input);

        // Expect size / 40
        expect(output.length).toBe(100);
    });

    it('should average DC values correctly', () => {
        const downsampler = new Downsampler();
        const input = new Float32Array(80); // 2 output samples
        input.fill(1.0); // All 1s

        const output = downsampler.process(input);

        expect(output.length).toBe(2);
        expect(output[0]).toBeCloseTo(1.0);
        expect(output[1]).toBeCloseTo(1.0);
    });

    it('should handle streaming state (partial blocks)', () => {
        const downsampler = new Downsampler();
        
        // Feed 20 samples (half a block)
        const input1 = new Float32Array(20);
        input1.fill(1.0);
        const out1 = downsampler.process(input1);
        expect(out1.length).toBe(0); // No output yet

        // Feed remaining 20 samples
        const input2 = new Float32Array(20);
        input2.fill(1.0);
        const out2 = downsampler.process(input2);
        
        expect(out2.length).toBe(1);
        expect(out2[0]).toBeCloseTo(1.0);
    });

    it('derives decimation factor from input sample rate', () => {
        const downsampler = new Downsampler(1_000_000, 50_000);

        expect(downsampler.getFactor()).toBe(20);
        expect(downsampler.getOutputSampleRateHz()).toBeCloseTo(50_000, 2);

        downsampler.setSampleRates(2_400_000, 50_000);
        expect(downsampler.getFactor()).toBe(48);
        expect(downsampler.getOutputSampleRateHz()).toBeCloseTo(50_000, 2);
    });
});
