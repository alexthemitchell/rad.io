import { describe, expect, it } from 'vitest';
import { NfmDemodulator } from './NfmDemodulator';

describe('NfmDemodulator', () => {
    it('produces stable output for constant rotation', () => {
        const demod = new NfmDemodulator();
        const input = new Int8Array(2048);
        const output = new Float32Array(1024);

        let theta = 0;
        const phaseStep = Math.PI / 6;

        for (let i = 0; i < 1024; i++) {
            input[2 * i] = Math.cos(theta) * 127;
            input[2 * i + 1] = Math.sin(theta) * 127;
            theta += phaseStep;
        }

        demod.process(input, output);

        const sample = output.slice(100, 200);
        const avg = sample.reduce((acc, x) => acc + x, 0) / sample.length;

        expect(avg).toBeGreaterThan(0.05);
        expect(avg).toBeLessThan(0.35);
    });
});
