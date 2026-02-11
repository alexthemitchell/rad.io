import { describe, it, expect } from 'vitest';
import { WfmDemodulator } from './WfmDemodulator';

describe('WfmDemodulator', () => {
    it('should demodulate a constant frequency offset (DC output)', () => {
        const demod = new WfmDemodulator();
        const input = new Int8Array(1024);
        const output = new Float32Array(512);

        // Generate a signal with constant frequency offset
        // Rotating +90 degrees (PI/2) per sample
        // I = cos(theta), Q = sin(theta)
        let theta = 0;
        const phaseStep = Math.PI / 2;

        for (let i = 0; i < 512; i++) {
            input[2*i] = Math.cos(theta) * 127;
            input[2*i+1] = Math.sin(theta) * 127;
            theta += phaseStep;
        }

        demod.process(input, output);

        // Expect output to be close to phaseStep (PI/2 = ~1.57)
        // Ignoring the first sample due to prevI/prevQ initialization
        for (let i = 1; i < 500; i++) {
            expect(output[i]).toBeCloseTo(Math.PI / 2, 1);
        }
    });

    it('should demodulate a chirp/sweep (Ramp output)', () => {
        const demod = new WfmDemodulator();
        const len = 1000;
        const input = new Int8Array(len * 2);
        const output = new Float32Array(len);

        let theta = 0;
        // Frequency increases linearly: freq(t) = k * t
        // Phase is integral of freq: theta(t) = 0.5 * k * t^2
        
        for (let i = 0; i < len; i++) {
            const freqOffset = (i / len) * Math.PI; // 0 to PI radians/sample
            theta += freqOffset;

            input[2*i] = Math.cos(theta) * 127;
            input[2*i+1] = Math.sin(theta) * 127;
        }

        demod.process(input, output);

        // Check a few points
        // i=100 -> freq ~ 0.1 * PI
        // i=500 -> freq ~ 0.5 * PI
        // i=900 -> freq ~ 0.9 * PI
        expect(output[100]).toBeCloseTo(0.1 * Math.PI, 1);
        expect(output[500]).toBeCloseTo(0.5 * Math.PI, 1);
        expect(output[900]).toBeCloseTo(0.9 * Math.PI, 1);
    });
});
