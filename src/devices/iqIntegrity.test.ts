import { describe, expect, it } from 'vitest';
import { analyzeCi8ToneIntegrity } from './iqIntegrity';
import { createGoldenToneFixtureBundle } from '../fixtures/sigmf/goldenToneFixture';

const EXPECTED_CYCLES_PER_BUFFER = 64;
const EXPECTED_COMPLEX_SAMPLES = 4096;
const EXPECTED_PHASE_STEP = (2 * Math.PI * EXPECTED_CYCLES_PER_BUFFER) / EXPECTED_COMPLEX_SAMPLES;
const EXPECTED_RMS = 60;

const invertCi8Channel = (byte: number): number => {
    const centered = byte - 128;
    const inverted = -centered;
    return Math.max(0, Math.min(255, inverted + 128));
};

describe('IQ integrity self-test', () => {
    it('recognizes canonical IQ mapping and scaling for the golden fixture', () => {
        const fixture = createGoldenToneFixtureBundle();
        const report = analyzeCi8ToneIntegrity(fixture.iqData, EXPECTED_PHASE_STEP, EXPECTED_RMS, fixture.iqData);

        expect(report.detectedMapping).toBe('iq');
        expect(report.likelySwapped).toBe(false);
        expect(report.likelyInvertedQuadrature).toBe(false);
        expect(report.bestVariant.phaseErrorRad).toBeLessThan(1e-3);
        expect(report.iqBalanceRatio).toBeGreaterThan(0.98);
        expect(report.iqBalanceRatio).toBeLessThan(1.02);
        expect(report.scaleRatio).toBeGreaterThan(0.98);
        expect(report.scaleRatio).toBeLessThan(1.02);
        expect(report.mappingError).toBe(0);
    });

    it('detects swapped I/Q ordering', () => {
        const fixture = createGoldenToneFixtureBundle();
        const swapped = new Uint8Array(fixture.iqData.length);

        for (let i = 0; i < fixture.iqData.length; i += 2) {
            swapped[i] = fixture.iqData[i + 1];
            swapped[i + 1] = fixture.iqData[i];
        }

        const report = analyzeCi8ToneIntegrity(swapped, EXPECTED_PHASE_STEP, EXPECTED_RMS, fixture.iqData);
        expect(report.detectedMapping).toBe('qi');
        expect(report.likelySwapped).toBe(true);
        expect(report.likelyInvertedQuadrature).toBe(false);
    });

    it('detects inverted quadrature sign', () => {
        const fixture = createGoldenToneFixtureBundle();
        const invertedQ = new Uint8Array(fixture.iqData.length);

        for (let i = 0; i < fixture.iqData.length; i += 2) {
            invertedQ[i] = fixture.iqData[i];
            invertedQ[i + 1] = invertCi8Channel(fixture.iqData[i + 1]);
        }

        const report = analyzeCi8ToneIntegrity(invertedQ, EXPECTED_PHASE_STEP, EXPECTED_RMS, fixture.iqData);
        expect(report.detectedMapping).toBe('i_neg_q');
        expect(report.likelySwapped).toBe(false);
        expect(report.likelyInvertedQuadrature).toBe(true);
    });

    it('stays stable under small additive noise on a known synthetic fixture', () => {
        const fixture = createGoldenToneFixtureBundle();
        const noisy = new Uint8Array(fixture.iqData);

        for (let i = 0; i < noisy.length; i += 1) {
            const centered = noisy[i] - 128;
            const perturbation = Math.round(Math.sin(i * 0.07) * 2);
            noisy[i] = Math.max(0, Math.min(255, centered + perturbation + 128));
        }

        const report = analyzeCi8ToneIntegrity(noisy, EXPECTED_PHASE_STEP, EXPECTED_RMS, fixture.iqData);
        expect(report.detectedMapping).toBe('iq');
        expect(report.bestVariant.coherence).toBeGreaterThan(0.95);
        expect(report.mappingError).toBeLessThan(4);
    });
});
