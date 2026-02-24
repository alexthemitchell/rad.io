import { describe, expect, it } from 'vitest';
import { AudioPllController } from './AudioPllController';

describe('AudioPllController', () => {
  it('nudges ratio upward when queue is below target', () => {
    const pll = new AudioPllController();
    const s = pll.update(20);
    expect(s.ratio).toBeGreaterThan(1);
  });

  it('nudges ratio downward when queue is above target', () => {
    const pll = new AudioPllController();
    pll.update(20);
    const s = pll.update(400);
    expect(s.ratio).toBeLessThan(1.01);
  });

  it('keeps ratio stable for non-finite queue inputs', () => {
    const pll = new AudioPllController();
    pll.update(20);
    const before = pll.getState().ratio;
    const after = pll.update(Number.NaN).ratio;

    expect(after).toBeCloseTo(before, 8);
  });

  it('resets ratio to unity', () => {
    const pll = new AudioPllController();
    pll.update(20);
    pll.reset();
    expect(pll.getState().ratio).toBe(1);
  });

  it('updates target queue when configured', () => {
    const pll = new AudioPllController();
    pll.setTargetQueueMs(80);
    const state = pll.getState();
    expect(state.targetQueueMs).toBe(80);
  });

  it('clamps configured target queue to supported bounds', () => {
    const pll = new AudioPllController();
    pll.setTargetQueueMs(5);
    expect(pll.getState().targetQueueMs).toBe(20);

    pll.setTargetQueueMs(1000);
    expect(pll.getState().targetQueueMs).toBe(400);
  });
});
