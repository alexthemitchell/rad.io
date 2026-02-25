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
      capability: null,
      hostBridge: {
        available: false,
        reason: 'bridge unavailable'
      }
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
      },
      hostBridge: {
        available: false,
        reason: 'bridge unavailable'
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
      },
      hostBridge: {
        available: false,
        reason: 'bridge unavailable'
      }
    });

    expect(plan.mode).toBe('software-fallback');
    expect(plan.canRun).toBe(true);
    expect(plan.blockers).toEqual(expect.arrayContaining(HACKRF_SWEEP_WEBUSB_BLOCKERS));
    expect(plan.blockers.join(' ')).toContain('bridge unavailable');
  });

  it('uses host-assisted hardware mode when bridge capability is available', () => {
    const plan = buildSweepExecutionPlan({
      sourceType: 'HACKRF',
      isStreaming: true,
      capability: {
        hardwareSupported: false,
        fallbackMode: 'software-sweep-stitch',
        command: 'hackrf_sweep',
        note: 'fallback'
      },
      hostBridge: {
        available: true,
        providerLabel: 'rad.io bridge daemon'
      }
    });

    expect(plan.mode).toBe('hardware-host-assisted');
    expect(plan.canRun).toBe(true);
    expect(plan.buttonLabel).toContain('Host Bridge');
    expect(plan.status).toContain('rad.io bridge daemon');
    expect(plan.blockers).toEqual([]);
  });

  it('defaults to software fallback when host bridge metadata is omitted', () => {
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
    expect(plan.blockers.join(' ')).toContain('host bridge availability not provided');
  });
});
