/**
 * VFO (Variable Frequency Oscillator) Limits and Configuration
 *
 * Defines resource limits, performance thresholds, and configuration
 * constants for the multi-VFO feature.
 *
 * Related: docs/reference/multi-vfo-user-guide.md
 * Related: docs/reference/multi-vfo-architecture.md
 */

/**
 * Default maximum number of simultaneous VFOs
 *
 * This conservative limit ensures stable performance across a wide range
 * of hardware configurations. The limit can be adjusted based on:
 * - System performance (CPU cores, RAM)
 * - Demodulation mode complexity (AM < FM < ATSC)
 * - User preferences
 *
 * Rationale for default of 4:
 * - Handles common use cases (aviation tower/ground/ATIS/weather)
 * - Leaves sufficient CPU headroom for UI (target <70% CPU)
 * - Conservative enough for mid-range laptops
 * - Can be increased on high-end systems
 *
 * @see {@link docs/reference/multi-vfo-architecture.md#resource-constraints} for detailed analysis
 */
export const DEFAULT_MAX_VFOS = 4;

/**
 * Absolute maximum VFO count (safety limit)
 *
 * Even on high-performance systems, this hard limit prevents
 * resource exhaustion and maintains application stability.
 */
export const ABSOLUTE_MAX_VFOS = 16;

/**
 * Minimum allowed VFO count
 *
 * At least one VFO should be allowed for basic functionality.
 */
export const MIN_VFOS = 1;

/**
 * DSP processing time warning threshold (milliseconds)
 *
 * When total DSP processing time for all VFOs exceeds this threshold
 * per sample batch, a warning is issued to the user.
 *
 * Target: <70% of frame budget to maintain 60 FPS
 * Frame budget: 16.67ms @ 60 FPS
 * DSP budget: ~8ms (leaving 5ms for UI, 3ms for FFT)
 */
export const DSP_TIME_WARNING_THRESHOLD_MS = 8.0;

/**
 * DSP processing time critical threshold (milliseconds)
 *
 * When DSP time exceeds this threshold, the system should take
 * automatic action (e.g., pause low-priority VFOs).
 *
 * This represents approximately 85% of frame budget.
 */
export const DSP_TIME_CRITICAL_THRESHOLD_MS = 12.0;

/**
 * Maximum concurrent audio streams
 *
 * Web Audio API and browser limitations restrict the number of
 * simultaneous audio sources. This limit prevents audio mixing issues.
 */
export const MAX_CONCURRENT_AUDIO_VFOS = 8;

/**
 * Per-mode complexity factors (relative to AM = 1.0)
 *
 * Used to calculate dynamic VFO limits based on active demodulator mix.
 * These values are based on performance benchmarks.
 */
export const VFO_COMPLEXITY_FACTORS: Record<string, number> = {
  am: 1.0,
  nbfm: 1.5,
  wbfm: 2.0,
  usb: 1.2,
  lsb: 1.2,
  cw: 0.8,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  "atsc-8vsb": 5.0, // Very CPU-intensive
};

/**
 * Platform-based maximum VFO recommendations
 *
 * These are suggested limits based on typical hardware capabilities.
 * The actual limit can be configured by the user or auto-detected.
 */
export const PLATFORM_MAX_VFOS: Record<string, number> = {
  // Modern desktop (8+ cores, 16+ GB RAM)
  // eslint-disable-next-line @typescript-eslint/naming-convention
  desktop_high: 12,

  // Mid-range desktop (4-6 cores, 8 GB RAM)
  // eslint-disable-next-line @typescript-eslint/naming-convention
  desktop_mid: 8,

  // Typical laptop (4 cores, 8 GB RAM)
  laptop: 6,

  // Mobile devices (limited CPU, battery concerns)
  mobile: 3,

  // Default/unknown platform
  default: DEFAULT_MAX_VFOS,
};

/**
 * Memory estimate per VFO (bytes)
 *
 * Approximate memory consumption per active VFO:
 * - VFO state object: ~1 KB
 * - Demodulator instance: ~50-500 KB (mode-dependent)
 * - Audio buffers: ~200 KB (if audio enabled)
 * - Channelizer output buffer: ~100 KB
 *
 * Average: ~400 KB per VFO
 */
export const MEMORY_PER_VFO_BYTES = 400 * 1024; // 400 KB

/**
 * Warning threshold for total VFO memory usage (bytes)
 *
 * When total estimated memory for all VFOs exceeds this threshold,
 * a warning is displayed to the user.
 *
 * 50 MB threshold = ~100+ VFOs, which is well beyond reasonable limits
 */
export const MEMORY_WARNING_THRESHOLD_BYTES = 50 * 1024 * 1024; // 50 MB

/**
 * Interval for resource usage checks (milliseconds)
 *
 * How often to check DSP time and memory usage for warnings.
 * Checked once per second to avoid excessive overhead.
 */
export const RESOURCE_CHECK_INTERVAL_MS = 1000;

/**
 * Calculate recommended max VFOs based on active demodulator complexity
 *
 * @param baseLimit - Base platform limit
 * @param activeVfos - Currently active VFO mode IDs
 * @returns Recommended remaining VFO slots
 */
export function calculateDynamicVfoLimit(
  baseLimit: number,
  activeVfos: Array<{ modeId: string }>,
): number {
  // Calculate complexity budget consumed
  let complexityUsed = 0;
  for (const vfo of activeVfos) {
    const complexity = VFO_COMPLEXITY_FACTORS[vfo.modeId] ?? 1.0;
    complexityUsed += complexity;
  }

  // Remaining complexity budget
  const complexityRemaining = Math.max(0, baseLimit - complexityUsed);

  return Math.floor(complexityRemaining);
}

/**
 * Get platform-specific VFO limit
 *
 * @param platform - Platform identifier (auto-detected or user-specified)
 * @returns Recommended max VFOs for the platform
 */
export function getPlatformVfoLimit(platform?: string): number {
  const defaultLimit = PLATFORM_MAX_VFOS["default"] ?? DEFAULT_MAX_VFOS;

  if (!platform) {
    return defaultLimit;
  }

  return PLATFORM_MAX_VFOS[platform] ?? defaultLimit;
}

/**
 * Validate max VFO count
 *
 * Ensures the requested max VFO count is within acceptable bounds.
 *
 * @param maxVfos - Requested max VFO count
 * @returns Clamped value within [MIN_VFOS, ABSOLUTE_MAX_VFOS]
 */
export function validateMaxVfos(maxVfos: number): number {
  return Math.max(MIN_VFOS, Math.min(ABSOLUTE_MAX_VFOS, Math.floor(maxVfos)));
}
