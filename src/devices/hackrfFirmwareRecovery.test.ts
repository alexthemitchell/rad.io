import { describe, expect, it } from 'vitest';
import { buildHackrfFirmwareRecoveryPlan } from './hackrfFirmwareRecovery';

describe('hackrfFirmwareRecovery', () => {
  it('returns bootloader recovery steps when DFU personality is detected', () => {
    const plan = buildHackrfFirmwareRecoveryPlan({
      status: 'known-unsupported',
      firmwareVersion: 'HackRF DFU bootloader',
      note: 'bootloader'
    });

    expect(plan.severity).toBe('error');
    expect(plan.bootloaderDetected).toBe(true);
    expect(plan.updateRequired).toBe(true);
    expect(plan.headline).toContain('DFU/bootloader');
  });

  it('returns update-required plan for known unsupported firmware versions', () => {
    const plan = buildHackrfFirmwareRecoveryPlan({
      status: 'known-unsupported',
      firmwareVersion: '2016.01.0',
      note: 'too old'
    });

    expect(plan.severity).toBe('error');
    expect(plan.bootloaderDetected).toBe(false);
    expect(plan.updateRequired).toBe(true);
    expect(plan.steps[0]).toContain('Update HackRF firmware');
  });

  it('returns stable guidance for known-good firmware', () => {
    const plan = buildHackrfFirmwareRecoveryPlan({
      status: 'known-good',
      firmwareVersion: '2024.02.1',
      note: 'validated'
    });

    expect(plan.severity).toBe('ok');
    expect(plan.updateRequired).toBe(false);
  });

  it('returns unknown plan when compatibility is unavailable', () => {
    const plan = buildHackrfFirmwareRecoveryPlan(null);
    expect(plan.severity).toBe('warn');
    expect(plan.headline).toContain('unknown');
  });
});
