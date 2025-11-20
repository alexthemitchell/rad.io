import { type HackRFMemoryInfo } from "./types";

export class MemoryManager {
  private totalBytesReceived = 0;
  private readonly maxBufferSize: number = 16 * 1024 * 1024; // 16 MB max

  /**
   * Track incoming buffer for memory management
   * Now only tracks rolling metrics, no retention.
   */
  trackBuffer(data: DataView): void {
    this.totalBytesReceived += data.byteLength;
  }

  /**
   * Get current memory usage information
   * Returns rolling counters instead of buffer retention stats
   */
  getMemoryInfo(): HackRFMemoryInfo {
    return {
      totalBufferSize: this.maxBufferSize,
      usedBufferSize: this.totalBytesReceived,
      activeBuffers: 0,
    };
  }

  /**
   * Clear all internal buffers and release memory
   * Resets counters since we don't retain buffers anymore
   */
  clearBuffers(): void {
    this.totalBytesReceived = 0;
  }
}
