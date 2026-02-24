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

    it('applies stronger smoothing for 75us voice preset than flat discriminator path', () => {
        const frameSize = 2048;
        const input = new Int8Array(frameSize * 2);
        const outputVoice = new Float32Array(frameSize);
        const outputDisc = new Float32Array(frameSize);

        for (let i = 0; i < frameSize; i++) {
            const theta = i * 0.45 + Math.sin(i * 0.18) * 0.5;
            input[2 * i] = Math.cos(theta) * 120;
            input[2 * i + 1] = Math.sin(theta) * 120;
        }

        const voice = new NfmDemodulator();
        voice.setConfig({ preset: 'voice-na-75us', outputPath: 'voice' });
        voice.process(input, outputVoice);

        const disc = new NfmDemodulator();
        disc.setConfig({ preset: 'flat-discriminator', outputPath: 'discriminator' });
        disc.process(input, outputDisc);

        const deltaVoice = outputVoice.subarray(1).reduce((acc, sample, idx) => acc + Math.abs(sample - outputVoice[idx]), 0);
        const deltaDisc = outputDisc.subarray(1).reduce((acc, sample, idx) => acc + Math.abs(sample - outputDisc[idx]), 0);

        expect(deltaVoice).toBeLessThan(deltaDisc);
    });

    it('uses lighter smoothing for 50us than 75us voice preset', () => {
        const input = new Int8Array(4096);
        const out75 = new Float32Array(2048);
        const out50 = new Float32Array(2048);

        for (let i = 0; i < 2048; i++) {
            const theta = i * 0.35 + Math.sin(i * 0.11) * 0.35;
            input[2 * i] = Math.cos(theta) * 110;
            input[2 * i + 1] = Math.sin(theta) * 110;
        }

        const d75 = new NfmDemodulator();
        d75.setConfig({ preset: 'voice-na-75us', outputPath: 'voice' });
        d75.process(input, out75);

        const d50 = new NfmDemodulator();
        d50.setConfig({ preset: 'voice-eu-50us', outputPath: 'voice' });
        d50.process(input, out50);

        const delta75 = out75.subarray(1).reduce((acc, sample, idx) => acc + Math.abs(sample - out75[idx]), 0);
        const delta50 = out50.subarray(1).reduce((acc, sample, idx) => acc + Math.abs(sample - out50[idx]), 0);

        expect(delta75).toBeLessThan(delta50);
    });
});
