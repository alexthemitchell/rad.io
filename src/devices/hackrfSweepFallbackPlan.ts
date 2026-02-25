import type { DeviceSweepCapability } from './ISDRDevice';

type SweepPlanMode = 'hardware' | 'software-fallback' | 'unavailable';

export type SweepExecutionPlan = {
  mode: SweepPlanMode;
  canRun: boolean;
  buttonLabel: string;
  status: string;
  blockers: string[];
};

export const HACKRF_SWEEP_WEBUSB_BLOCKERS: string[] = [
  'WebUSB cannot launch the host-native `hackrf_sweep` process required by libhackrf sweep mode.',
  'Current WebUSB HackRF driver only exposes vendor control + bulk IQ streaming operations and has no sweep transfer command path.',
  'The app only executes software tune/settle/stitch in-browser for sweep today.'
];

export const buildSweepExecutionPlan = (input: {
  sourceType: 'MOCK' | 'HACKRF' | 'RTLSDR' | 'FILE';
  isStreaming: boolean;
  capability: DeviceSweepCapability | null;
}): SweepExecutionPlan => {
  if (!input.isStreaming) {
    return {
      mode: 'unavailable',
      canRun: false,
      buttonLabel: 'Start Streaming To Sweep',
      status: 'Sweep requires an active stream session.',
      blockers: []
    };
  }

  if (input.capability?.hardwareSupported) {
    return {
      mode: 'hardware',
      canRun: true,
      buttonLabel: 'Run Hardware Sweep',
      status: 'Hardware sweep is available on this active device path.',
      blockers: []
    };
  }

  if (input.sourceType === 'HACKRF') {
    return {
      mode: 'software-fallback',
      canRun: true,
      buttonLabel: 'Run Software Sweep/Stitch',
      status: input.capability?.note ?? 'Hardware sweep unavailable in current WebUSB path; using software fallback.',
      blockers: HACKRF_SWEEP_WEBUSB_BLOCKERS
    };
  }

  return {
    mode: 'software-fallback',
    canRun: true,
    buttonLabel: 'Run Sweep/Stitch',
    status: input.capability?.note ?? 'Using software tune/settle/stitch sweep path.',
    blockers: []
  };
};
