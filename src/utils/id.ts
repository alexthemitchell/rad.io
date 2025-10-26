/**
 * ID generation utilities for stable, low-collision identifiers.
 *
 * For bookmarks, prefer a cryptographically strong source when available
 * (Web Crypto API). Falls back to a timestamp + random + counter strategy
 * when crypto is not available (e.g., during tests or older environments).
 */

// Minimal Crypto-like interface for testable injection
export type CryptoLike = {
  randomUUID?: () => string;
  getRandomValues?: (
    array: Uint8Array | Uint32Array,
  ) => Uint8Array | Uint32Array;
};

// Module-level counter to greatly reduce collision risk in same-tick calls
let idCounter = 0;

/**
 * Generate a unique bookmark ID with a stable prefix.
 *
 * Contract
 * - Input: optional crypto implementation (used for testing); when omitted, uses globalThis.crypto if available
 * - Output: string that begins with "bm-" followed by a UUID-like token
 * - Error modes: none (pure function)
 */
export function generateBookmarkId(cryptoImpl?: CryptoLike): string {
  const c = getCrypto(cryptoImpl);

  // Prefer standard UUID v4 if available (browser, modern Node)
  if (c?.randomUUID) {
    return `bm-${c.randomUUID()}`;
  }

  // If we have getRandomValues, synthesize a UUID-like 128-bit value
  if (c?.getRandomValues) {
    const arr = new Uint32Array(4);
    c.getRandomValues(arr);
    const hex = Array.from(arr)
      .map((n) => n.toString(16).padStart(8, "0"))
      .join("");
    // Format 8-4-4-4-12
    const formatted = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
    return `bm-${formatted}`;
  }

  // Fallback: time + random + counter (best-effort uniqueness without crypto)
  // Using base36 reduces length while preserving entropy.
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10); // ~41 bits
  idCounter = (idCounter + 1) & 0xffffffff; // 32-bit counter with wraparound
  const cnt = idCounter.toString(36).padStart(7, "0"); // pad for up to 32-bit value in base36
  return `bm-${time}-${rand}-${cnt}`;
}

/**
 * Generic ID generator with custom prefix. Exposed for potential reuse.
 */
export function generateId(prefix: string, cryptoImpl?: CryptoLike): string {
  const id = generateBookmarkId(cryptoImpl).replace(/^bm-/, "");
  return `${prefix}-${id}`;
}

/**
 * Helper to obtain a Crypto-like implementation.
 * Prefer the provided override (for tests), otherwise use globalThis.crypto when available.
 */
export function getCrypto(override?: CryptoLike): CryptoLike | undefined {
  if (override) {
    return override;
  }
  const g = globalThis as unknown as { crypto?: CryptoLike };
  return g.crypto;
}
