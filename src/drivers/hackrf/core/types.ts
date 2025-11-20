import { type VendorRequest } from "../constants";

export const UINT32_MAX = 0xffffffff;
export const MHZ_IN_HZ = 1_000_000;

// HackRF One frequency range (per specifications)
export const MIN_FREQUENCY_HZ = 1_000_000; // 1 MHz
export const MAX_FREQUENCY_HZ = 6_000_000_000; // 6 GHz

// HackRF One sample rate range
export const MIN_SAMPLE_RATE = 2_000_000; // 2 MSPS
export const MAX_SAMPLE_RATE = 20_000_000; // 20 MSPS

export type ControlTransferOutProps = {
  command: VendorRequest;
  value?: number;
  data?: BufferSource;
  index?: number;
};

export interface HackRFMemoryInfo {
  totalBufferSize: number;
  usedBufferSize: number;
  activeBuffers: number;
}

export interface HackRFConfigurationStatus {
  isOpen: boolean;
  isStreaming: boolean;
  isClosing: boolean;
  sampleRate: number | null;
  frequency: number | null;
  bandwidth: number | null;
  lnaGain: number | null;
  ampEnabled: boolean;
  isConfigured: boolean;
}

export interface HackRFStreamValidation {
  ready: boolean;
  issues: string[];
}

export enum DeviceState {
  IDLE = "IDLE",
  CONFIGURING = "CONFIGURING",
  STREAMING = "STREAMING",
  RECOVERING = "RECOVERING",
  CLOSING = "CLOSING",
}

export interface DeviceStateProvider {
  state: DeviceState;
}
