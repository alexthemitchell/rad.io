import type { DeviceDebugSnapshot } from './ISDRDevice';

export type HackrfFirmwareRecoveryPlan = {
  severity: 'ok' | 'warn' | 'error';
  updateRequired: boolean;
  bootloaderDetected: boolean;
  headline: string;
  steps: string[];
};

const UNKNOWN_PLAN: HackrfFirmwareRecoveryPlan = {
  severity: 'warn',
  updateRequired: false,
  bootloaderDetected: false,
  headline: 'Firmware compatibility is unknown for this session.',
  steps: [
    'Run stream start + diagnostics export and attach the USB compatibility section if support is needed.',
    'If streaming is unstable, switch to Stable USB profile and retry before changing firmware.'
  ]
};

export const buildHackrfFirmwareRecoveryPlan = (
  compatibility: DeviceDebugSnapshot['compatibility'] | null | undefined
): HackrfFirmwareRecoveryPlan => {
  if (!compatibility) {
    return UNKNOWN_PLAN;
  }

  const firmwareVersion = compatibility.firmwareVersion ?? 'unknown';
  const bootloaderDetected = /dfu|bootloader/i.test(firmwareVersion);

  if (bootloaderDetected) {
    return {
      severity: 'error',
      updateRequired: true,
      bootloaderDetected: true,
      headline: 'HackRF is in DFU/bootloader mode and cannot stream until normal firmware is restored.',
      steps: [
        'Connect HackRF to a native host toolchain and flash normal firmware/application image.',
        'Power-cycle and replug the device, then confirm it enumerates as HackRF One (PID 0x6089).',
        'Re-open rad.io and retry Start; export diagnostics if compatibility still reports unsupported.'
      ]
    };
  }

  if (compatibility.status === 'known-unsupported') {
    return {
      severity: 'error',
      updateRequired: true,
      bootloaderDetected: false,
      headline: 'Firmware version is known-unsupported for stable WebUSB streaming.',
      steps: [
        'Update HackRF firmware to a known-good release in this app family (for example 2021.03.1+).',
        'After update, power-cycle/replug and verify firmware version in the Health panel.',
        'Re-run a short streaming validation and export diagnostics to capture post-update counters.'
      ]
    };
  }

  if (compatibility.status === 'known-good') {
    return {
      severity: 'ok',
      updateRequired: false,
      bootloaderDetected: false,
      headline: 'Firmware is known-good for current WebUSB profile defaults.',
      steps: [
        'If stalls continue, run USB auto-tuner and keep diagnostics traces for support.',
        'Keep power and USB path stable (direct port or known-good powered hub).'
      ]
    };
  }

  return UNKNOWN_PLAN;
};
