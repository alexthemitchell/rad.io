import type { DetectedSignal } from "../../hooks/useSignalDetection";

// US FM Broadcast grid: 88.1 MHz to 107.9 MHz in 200 kHz steps
const FM_MIN_HZ = 88_000_000;
const FM_MAX_HZ = 108_000_000;
const GRID_START_HZ = 88_100_000;
const GRID_STEP_HZ = 200_000;

function nearestFmChannelCenter(freqHz: number): number {
  const steps = Math.round((freqHz - GRID_START_HZ) / GRID_STEP_HZ);
  return GRID_START_HZ + steps * GRID_STEP_HZ;
}

export interface PpmEstimate {
  ppm: number;
  count: number;
}

/**
 * Estimate device frequency PPM using detected wideband FM broadcast carriers.
 * Strategy: compare measured carrier frequency to nearest 200 kHz grid center,
 * compute per-station ppm, then return trimmed-mean if stable.
 */
export function estimateFMBroadcastPPM(
  signals: DetectedSignal[],
): PpmEstimate | null {
  const candidates = signals
    .filter((s) => s.isActive && s.type === "wideband-fm")
    .filter((s) => s.frequency >= FM_MIN_HZ && s.frequency <= FM_MAX_HZ)
    .map((s) => ({ f: s.frequency, p: s.power }));

  if (candidates.length < 2) return null;

  // Build per-signal ppm estimates, reject obvious mismatches (>100 kHz from grid)
  const ppmSamples: number[] = [];
  for (const c of candidates) {
    const center = nearestFmChannelCenter(c.f);
    const errHz = c.f - center;
    if (Math.abs(errHz) > 100_000) continue; // likely not a true center
    const ppm = (errHz / center) * 1_000_000;
    // Discard extreme outliers
    if (!Number.isFinite(ppm) || Math.abs(ppm) > 500) continue;
    ppmSamples.push(ppm);
  }

  if (ppmSamples.length < 2) return null;

  // Trimmed mean (20%) for robustness
  ppmSamples.sort((a, b) => a - b);
  const trim = Math.floor(ppmSamples.length * 0.2);
  const trimmed = ppmSamples.slice(trim, ppmSamples.length - trim || undefined);
  const mean = trimmed.reduce((a, b) => a + b, 0) / trimmed.length;

  // Basic stability check: low variance and reasonable magnitude
  const variance =
    trimmed.reduce((a, b) => a + (b - mean) * (b - mean), 0) / trimmed.length;
  const std = Math.sqrt(variance);
  if (!Number.isFinite(mean) || std > 30) return null;

  return { ppm: mean, count: trimmed.length };
}
