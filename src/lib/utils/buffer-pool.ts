/**
 * Buffer pooling for GC optimization
 * Implements ADR-0002: Web Worker DSP Architecture
 */

class ArrayBufferPool {
  private pools = new Map<number, ArrayBuffer[]>();

  /**
   * Acquire a buffer of the specified size from the pool
   * @param size Buffer size in bytes
   * @returns ArrayBuffer from pool or newly allocated
   */
  acquire(size: number): ArrayBuffer {
    const pool = this.pools.get(size) ?? [];
    return pool.pop() ?? new ArrayBuffer(size);
  }

  /**
   * Release a buffer back to the pool for reuse
   * @param buffer ArrayBuffer to return to pool
   */
  release(buffer: ArrayBuffer): void {
    const size = buffer.byteLength;
    if (!this.pools.has(size)) {
      this.pools.set(size, []);
    }
    const pool = this.pools.get(size);
    if (pool) {
      pool.push(buffer);
    }
  }

  /**
   * Clear all pooled buffers
   */
  clear(): void {
    this.pools.clear();
  }
}

export const bufferPool = new ArrayBufferPool();
