// ATSC convolutional deinterleaver parameters
const I = 52; // number of branches
const M = 4; // spacing (bytes)

// Persistent deinterleaver state across calls
const branches: number[][] = Array.from({ length: I }, () => []);
const delays: number[] = Array.from({ length: I }, (_, i) => i * M);
let writeIndex = 0;

/**
 * Streaming convolutional deinterleaver (B=52, M=4).
 * Maintains output length equal to input length during warmup by falling back
 * to immediate passthrough for underfilled branches.
 */
export function atscDeinterleave(bytes: Uint8Array): Uint8Array {
  if (bytes.length === 0) return bytes;
  const out = new Uint8Array(bytes.length);
  let outPos = 0;

  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i] ?? 0;
    const d = delays[writeIndex] ?? 0;
    const q = branches[writeIndex] ?? [];

    // Push new byte to branch queue
    q.push(b);

    // If the branch is filled beyond its delay, emit oldest; else passthrough
    if (q.length > d) {
      const val = q.shift() ?? b;
      out[outPos++] = val;
    } else {
      out[outPos++] = b;
    }

    // Advance to next branch
    writeIndex = (writeIndex + 1) % I;
  }

  return out;
}
