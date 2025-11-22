/**
 * VFO Resource Monitor
 *
 * Monitors DSP processing time, memory usage, and audio stream count
 * for all active VFOs. Issues warnings when resource thresholds are exceeded.
 *
 * Related: docs/reference/multi-vfo-user-guide.md
 * Related: src/constants/vfoLimits.ts
 */

import {
  DSP_TIME_CRITICAL_THRESHOLD_MS,
  DSP_TIME_WARNING_THRESHOLD_MS,
  MAX_CONCURRENT_AUDIO_VFOS,
  MEMORY_PER_VFO_BYTES,
  MEMORY_WARNING_THRESHOLD_BYTES,
} from "../constants/vfoLimits";
import { VfoResourceWarning } from "../types/vfo";
import type { VfoState } from "../types/vfo";

/**
 * Resource usage statistics for all VFOs
 */
export interface VfoResourceStats {
  /** Total DSP processing time across all VFOs (ms) */
  totalDspTime: number;

  /** Estimated total memory usage (bytes) */
  estimatedMemory: number;

  /** Number of VFOs with audio enabled */
  audioStreamCount: number;

  /** Active warnings */
  warnings: VfoResourceWarning[];

  /** Timestamp of last check */
  timestamp: number;
}

/**
 * Calculate total DSP processing time from VFO metrics
 *
 * @param vfos - Array of active VFO states
 * @returns Total processing time in milliseconds
 */
export function calculateTotalDspTime(vfos: VfoState[]): number {
  return vfos.reduce((total, vfo) => {
    return total + (vfo.metrics.processingTime || 0);
  }, 0);
}

/**
 * Estimate total memory usage from VFO count
 *
 * This is a rough estimate based on average per-VFO memory consumption.
 * Actual usage varies by demodulation mode.
 *
 * @param vfoCount - Number of active VFOs
 * @returns Estimated memory usage in bytes
 */
export function estimateVfoMemoryUsage(vfoCount: number): number {
  return vfoCount * MEMORY_PER_VFO_BYTES;
}

/**
 * Count VFOs with audio enabled
 *
 * @param vfos - Array of VFO states
 * @returns Number of VFOs with audioEnabled=true
 */
export function countAudioStreams(vfos: VfoState[]): number {
  return vfos.filter((vfo) => vfo.audioEnabled).length;
}

/**
 * Check resource usage and generate warnings
 *
 * Analyzes current VFO resource consumption and returns any applicable warnings.
 *
 * @param vfos - Array of all VFO states
 * @returns Resource statistics including warnings
 */
export function checkVfoResources(vfos: VfoState[]): VfoResourceStats {
  const warnings: VfoResourceWarning[] = [];

  // Calculate metrics
  const totalDspTime = calculateTotalDspTime(vfos);
  const estimatedMemory = estimateVfoMemoryUsage(vfos.length);
  const audioStreamCount = countAudioStreams(vfos);

  // Check DSP time warnings
  if (totalDspTime >= DSP_TIME_CRITICAL_THRESHOLD_MS) {
    warnings.push(VfoResourceWarning.DSP_TIME_CRITICAL);
  } else if (totalDspTime >= DSP_TIME_WARNING_THRESHOLD_MS) {
    warnings.push(VfoResourceWarning.DSP_TIME_WARNING);
  }

  // Check memory warnings
  if (estimatedMemory >= MEMORY_WARNING_THRESHOLD_BYTES) {
    warnings.push(VfoResourceWarning.MEMORY_WARNING);
  }

  // Check audio stream limit
  if (audioStreamCount > MAX_CONCURRENT_AUDIO_VFOS) {
    warnings.push(VfoResourceWarning.AUDIO_LIMIT);
  }

  return {
    totalDspTime,
    estimatedMemory,
    audioStreamCount,
    warnings,
    timestamp: Date.now(),
  };
}

/**
 * Get human-readable warning message
 *
 * @param warning - Warning type
 * @param stats - Current resource statistics
 * @returns User-friendly warning message
 */
export function getWarningMessage(
  warning: VfoResourceWarning,
  stats: VfoResourceStats,
): string {
  switch (warning) {
    case VfoResourceWarning.DSP_TIME_WARNING:
      return `⚠️ High CPU usage: DSP processing time (${stats.totalDspTime.toFixed(1)}ms) approaching limit. Consider reducing VFO count or pausing low-priority VFOs.`;

    case VfoResourceWarning.DSP_TIME_CRITICAL:
      return `🚨 Critical CPU usage: DSP processing time (${stats.totalDspTime.toFixed(1)}ms) exceeds safe limit. Performance degradation likely. Reduce VFO count immediately.`;

    case VfoResourceWarning.MEMORY_WARNING:
      return `⚠️ High memory usage: Estimated ${(stats.estimatedMemory / (1024 * 1024)).toFixed(1)}MB consumed by VFOs. Consider reducing VFO count.`;

    case VfoResourceWarning.AUDIO_LIMIT:
      return `⚠️ Too many audio streams: ${stats.audioStreamCount} concurrent streams exceeds recommended limit of ${MAX_CONCURRENT_AUDIO_VFOS}. Disable audio on some VFOs.`;

    case VfoResourceWarning.NONE:
    default:
      return "";
  }
}

/**
 * Log resource warnings to console
 *
 * Issues console warnings for all active resource warnings.
 *
 * @param stats - Resource statistics with warnings
 */
export function logResourceWarnings(stats: VfoResourceStats): void {
  for (const warning of stats.warnings) {
    if (warning !== VfoResourceWarning.NONE) {
      console.warn(getWarningMessage(warning, stats));
    }
  }
}

/**
 * Suggest VFO to pause based on priority
 *
 * When resources are constrained, this function recommends which VFO
 * to pause first (lowest priority, least recently used).
 *
 * @param vfos - Array of active VFO states
 * @returns ID of recommended VFO to pause, or null if none
 */
export function suggestVfoToPause(vfos: VfoState[]): string | null {
  if (vfos.length === 0) {
    return null;
  }

  // Sort by priority (ascending) and then by creation time (oldest first)
  const sorted = [...vfos].sort((a, b) => {
    const priorityDiff = (a.priority ?? 5) - (b.priority ?? 5);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }
    // If priorities are equal, prefer older VFOs (created earlier)
    return (a.createdAt ?? 0) - (b.createdAt ?? 0);
  });

  return sorted[0]?.id ?? null;
}
