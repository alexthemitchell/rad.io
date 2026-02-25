import type { DeviceSweepCapability } from './ISDRDevice';

type SweepPlanMode = 'hardware' | 'hardware-host-assisted' | 'software-fallback' | 'unavailable';

export type SweepExecutionPlan = {
  mode: SweepPlanMode;
  canRun: boolean;
  buttonLabel: string;
  status: string;
  blockers: string[];
};

export type SweepHostBridgeAvailability = {
  available: boolean;
  providerLabel?: string;
  reason?: string;
};

export const HACKRF_SWEEP_WEBUSB_BLOCKERS: string[] = [
  'WebUSB cannot launch the host-native `hackrf_sweep` process required by libhackrf sweep mode.',
  'Current WebUSB HackRF driver only exposes vendor control + bulk IQ streaming operations and has no sweep transfer command path.',
  'The app only executes software tune/settle/stitch in-browser for sweep today.'
];

export const HACKRF_SWEEP_HOST_BRIDGE_BLOCKERS: string[] = [
  'Host-assisted sweep bridge not detected; install/enable a bridge exposing `window.__RADIO_HOST_BRIDGE__.runHackrfSweep` with `hackrf-sweep` capability.',
  'Until host bridge capability is available, sweep runs in software tune/settle/stitch mode.',
  'Export diagnostics and include sweep blocker evidence when requesting hardware sweep support.'
];

export const buildSweepExecutionPlan = (input: {
  sourceType: 'MOCK' | 'HACKRF' | 'RTLSDR' | 'AIRSPY' | 'SDRPLAY' | 'PLUTO' | 'LIMESDR' | 'FILE';
  isStreaming: boolean;
  capability: DeviceSweepCapability | null;
  hostBridge?: SweepHostBridgeAvailability;
}): SweepExecutionPlan => {
  const hostBridge: SweepHostBridgeAvailability = input.hostBridge ?? {
    available: false,
    reason: 'host bridge availability not provided'
  };

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
    if (hostBridge.available && input.capability?.command === 'hackrf_sweep') {
      return {
        mode: 'hardware-host-assisted',
        canRun: true,
        buttonLabel: 'Run Hardware Sweep (Host Bridge)',
        status: `Hardware sweep delegated to ${hostBridge.providerLabel ?? 'host bridge'} via hackrf_sweep.`,
        blockers: []
      };
    }

    return {
      mode: 'software-fallback',
      canRun: true,
      buttonLabel: 'Run Software Sweep/Stitch',
      status: input.capability?.note ?? 'Hardware sweep unavailable in current WebUSB path; using software fallback.',
      blockers: [...HACKRF_SWEEP_WEBUSB_BLOCKERS, ...HACKRF_SWEEP_HOST_BRIDGE_BLOCKERS, ...(hostBridge.reason ? [`Bridge probe detail: ${hostBridge.reason}`] : [])]
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
