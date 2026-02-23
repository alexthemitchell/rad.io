import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MockDevice } from './MockDevice';
import type { SDRStreamFrame } from './streamFrame';

describe('MockDevice stream frame invariants', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-02-23T00:00:00.000Z'));
    });

    afterEach(async () => {
        vi.useRealTimers();
    });

    it('emits monotonic sequence/timestamps with sample-count continuity', async () => {
        const dev = new MockDevice();
        const frames: SDRStreamFrame[] = [];

        await dev.open();
        await dev.setSampleRate(2_000_000);

        await dev.start((_data, frame) => {
            if (frame) {
                frames.push(frame);
            }
        });

        await vi.advanceTimersByTimeAsync(60);
        await dev.stop();

        expect(frames.length).toBeGreaterThanOrEqual(4);

        for (let i = 0; i < frames.length; i++) {
            const current = frames[i];
            expect(current.sequence).toBe(i);
            expect(current.sampleCount).toBeGreaterThan(0);
            expect(current.sampleClock?.truthMode).toBe('unknown');

            if (current.discontinuity) {
                expect(current.discontinuity.sequence).toBe(current.sequence);
                expect(current.discontinuity.sampleIndex).toBe(current.sampleIndex);
            }

            if (i === 0) {
                continue;
            }

            const prev = frames[i - 1];
            expect(current.sequence).toBe(prev.sequence + 1);
            expect(current.sampleIndex).toBe(prev.sampleIndex + prev.sampleCount + current.droppedSamples);
            expect(current.timestampNs).toBeGreaterThan(prev.timestampNs);

            if (current.droppedSamples > 0) {
                expect(current.discontinuity).toBeDefined();
            }
        }
    });

    it('marks restart and retune as explicit discontinuities', async () => {
        const dev = new MockDevice();
        const frames: SDRStreamFrame[] = [];

        await dev.open();

        await dev.start((_data, frame) => {
            if (frame) {
                frames.push(frame);
            }
        });

        await vi.advanceTimersByTimeAsync(20);
        await dev.setFrequency(101_000_000);
        await vi.advanceTimersByTimeAsync(30);
        await dev.stop();

        expect(frames.length).toBeGreaterThanOrEqual(3);
        expect(frames[0].discontinuity?.cause).toBe('restart');

        const retuneFrame = frames.find((frame) => frame.discontinuity?.cause === 'retune');
        expect(retuneFrame).toBeDefined();

        const moreFrames: SDRStreamFrame[] = [];
        await dev.start((_data, frame) => {
            if (frame) {
                moreFrames.push(frame);
            }
        });

        await vi.advanceTimersByTimeAsync(20);
        await dev.stop();

        expect(moreFrames.length).toBeGreaterThanOrEqual(1);
        expect(moreFrames[0].discontinuity?.cause).toBe('restart');
    });
});
