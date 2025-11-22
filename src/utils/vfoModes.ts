/**
 * VFO Mode Configurations
 *
 * Shared configuration for VFO modes including bandwidth settings.
 */

export interface VfoModeConfig {
  id: string;
  label: string;
  bandwidthHz: number;
}

/**
 * Available demodulation modes for VFO creation
 */
export const VFO_MODE_CONFIGS: readonly VfoModeConfig[] = [
  { id: "am", label: "AM", bandwidthHz: 10_000 },
  { id: "wbfm", label: "WBFM", bandwidthHz: 200_000 },
  { id: "nbfm", label: "NBFM", bandwidthHz: 12_500 },
  { id: "usb", label: "USB", bandwidthHz: 3_000 },
  { id: "lsb", label: "LSB", bandwidthHz: 3_000 },
] as const;

/**
 * Get bandwidth for a given mode ID
 */
export function getVfoModeBandwidth(modeId: string): number {
  const config = VFO_MODE_CONFIGS.find((m) => m.id === modeId);
  return config?.bandwidthHz ?? 10_000; // Default to AM bandwidth
}
