/**
 * USB Retry Utility for HackRF Driver
 *
 * Provides standardized transient error handling and exponential backoff
 * for USB control transfers and other device operations.
 */

export interface RetryOptions {
  /** Maximum number of attempts (default: 3) */
  attempts?: number;
  /** Initial delay in ms before first retry (default: 100) */
  baseDelay?: number;
  /** Maximum delay in ms between retries (default: 1000) */
  maxDelay?: number;
  /**
   * Custom error classifier. Returns true if error is transient/retryable.
   * If not provided, uses default isTransientError check.
   */
  classify?: (error: unknown) => boolean;
  /** Optional callback invoked before each retry */
  onRetry?: (attempt: number, error: unknown) => void | Promise<void>;
}

/**
 * Checks if an error is a transient USB error that warrants a retry.
 * Covers InvalidStateError, NetworkError, and common transfer error messages.
 */
export function isTransientError(error: unknown): boolean {
  const e = error as Error & { name?: string; message?: string };
  const msg = typeof e.message === "string" ? e.message : "";
  return (
    e.name === "InvalidStateError" ||
    e.name === "NetworkError" ||
    /transfer error/i.test(msg)
  );
}

/**
 * Executes an operation with exponential backoff retries for transient errors.
 */
export async function runWithRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    attempts = 3,
    baseDelay = 100,
    maxDelay = 1000,
    classify = isTransientError,
    onRetry,
  } = options;

  let lastError: unknown;
  let currentDelay = baseDelay;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;

      // If this was the last attempt, throw immediately
      if (attempt === attempts) {
        throw err;
      }

      // Check if error is retryable
      if (!classify(err)) {
        throw err;
      }

      // Notify listener if provided
      if (onRetry) {
        await onRetry(attempt, err);
      }

      // Wait before next attempt
      await new Promise((resolve) => setTimeout(resolve, currentDelay));

      // Exponential backoff with cap
      currentDelay = Math.min(currentDelay * 2, maxDelay);
    }
  }

  throw lastError;
}
