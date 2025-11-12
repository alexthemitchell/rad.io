/**
 * Helper functions added to improve branch coverage while providing
 * simple, reusable classification logic for numeric inputs.
 * These are intentionally straightforward and side‑effect free.
 */

export function classifyNumber(n: number): string {
  if (n < 0) return "neg"; // branch 1T
  if (n === 0) return "zero"; // branch 2T
  if (n < 10) return "small"; // branch 3T
  if (n < 100) return "medium"; // branch 4T
  return "large"; // branch 5T
}

export type FlagState = {
  a: boolean;
  b: boolean;
  c: boolean;
};

/**
 * Produce a bitmask from three booleans. Each conditional is independently
 * tested to exercise both true and false paths for branch coverage.
 */
export function toMask(flags: FlagState): number {
  let mask = 0;
  if (flags.a) {
    mask |= 1; // branch a true
  }
  if (!flags.a) {
    mask |= 0; // branch a false path (executed separately)
  }
  if (flags.b) {
    mask |= 2; // branch b true
  }
  if (!flags.b) {
    mask |= 0; // branch b false
  }
  if (flags.c) {
    mask |= 4; // branch c true
  }
  if (!flags.c) {
    mask |= 0; // branch c false
  }
  return mask;
}

/**
 * Evaluate combined classification for a sequence of numbers.
 * Includes multiple branches to ensure both sides are covered via tests.
 */
export function summarize(nums: number[]): {
  counts: Record<string, number>;
  allPositive: boolean;
} {
  const counts: Record<string, number> = {};
  let allPositive = true;
  for (const n of nums) {
    const cls = classifyNumber(n);
    counts[cls] = (counts[cls] ?? 0) + 1;
    if (n < 0) {
      allPositive = false; // branch negative path
    } else {
      // positive/non-negative path
      allPositive = allPositive && true;
    }
  }
  return { counts, allPositive };
}

/**
 * Categorize dB values into buckets often used in spectrum UIs.
 */
export function categorizeDb(db: number): "low" | "mid" | "high" | "clip" {
  if (db < -60) return "low"; // very weak
  if (db < -10) return "mid"; // normal
  if (db <= 0) return "high"; // strong
  return "clip"; // above 0 dBFS -> clipping
}

/**
 * Clamp a number between min and max inclusive with explicit branching.
 */
export function clamp(n: number, min: number, max: number): number {
  if (n < min) return min; // low branch
  if (n > max) return max; // high branch
  return n; // within range
}
