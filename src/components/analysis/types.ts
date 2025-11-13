/**
 * Shared types for ATSC signal analysis components
 */

/**
 * IQ sample data point
 */
export interface Sample {
  I: number;
  Q: number;
}

/**
 * ATSC 8-VSB symbol levels (normalized)
 * These are the 8 discrete amplitude levels used in ATSC digital television
 */
export const VSB_LEVELS = [-7, -5, -3, -1, 1, 3, 5, 7];
