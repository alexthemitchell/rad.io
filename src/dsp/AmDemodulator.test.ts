import { describe, it, expect } from 'vitest';
import { AmDemodulator } from './AmDemodulator';

describe('AmDemodulator', () => {
    it('should demodulate an AM signal', () => {
        const demod = new AmDemodulator();
        const len = 1000;
        const input = new Int8Array(len * 2);
        const output = new Float32Array(len);

        // Carrier freq = 0 (Baseband)
        // Signal = (1 + m*sin(wt)) * Carrier
        // In IQ Baseband, Carrier is constant DC (e.g. 1.0)
        // So Magnitude = 1 + 0.5 * sin(wt)
        
        for (let i = 0; i < len; i++) {
            const audio = Math.sin(i * 0.1) * 0.5; // Audio tone
            const envelope = 0.8 + audio; // Carrier offset (0.8)

            // Pure Real signal for simplicity (or random phase)
            // I = Envelope, Q = 0
            input[2*i] = envelope * 100; 
            input[2*i+1] = 0;
        }

        demod.process(input, output);

        // Check if output resembles the audio tone
        // The DC blocker needs time to settle, so check later samples
        
        // At i=500
        const expectedAudio = Math.sin(500 * 0.1) * 0.5;
        // The input was scaled by 100/128 ~= 0.78
        // So expected output is roughly expectedAudio * 0.78
        
        const scale = 100/128;
        expect(output[500]).toBeCloseTo(expectedAudio * scale, 0.1);
    });
});
