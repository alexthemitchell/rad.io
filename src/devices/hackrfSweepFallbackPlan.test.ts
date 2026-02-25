import { describe, expect, it } from 'vitest';
import {
  buildSweepExecutionPlan,
  HACKRF_SWEEP_WEBUSB_BLOCKERS
} from './hackrfSweepFallbackPlan';

describe('buildSweepExecutionPlan', () => {
  it('blocks sweep actions when stream is inactive', () => {
    const plan = buildSweepExecutionPlan({
      sourceType: 'HACKRF',
      isStreaming: false,
      capability: null
    });

    expect(plan.canRun).toBe(false);
    expect(plan.mode).toBe('unavailable');
    expect(plan.buttonLabel).toContain('Start Streaming');
  });

  it('uses hardware mode when capability reports support', () => {
    const plan = buildSweepExecutionPlan({
      sourceType: 'HACKRF',
      isStreaming: true,
      capability: {
        hardwareSupported: true,
        fallbackMode: 'none'
      }
    });

    expect(plan.mode).toBe('hardware');
    expect(plan.canRun).toBe(true);
    expect(plan.blockers).toEqual([]);
  });

  it('uses software fallback with explicit blockers for HackRF WebUSB path', () => {
    const plan = buildSweepExecutionPlan({
      sourceType: 'HACKRF',
      isStreaming: true,
      capability: {
        hardwareSupported: false,
        fallbackMode: 'software-sweep-stitch',
        command: 'hackrf_sweep',
        note: 'fallback'
      }
    });

    expect(plan.mode).toBe('software-fallback');
    expect(plan.canRun).toBe(true);
    expect(plan.blockers).toEqual(HACKRF_SWEEP_WEBUSB_BLOCKERS);
  });
});
