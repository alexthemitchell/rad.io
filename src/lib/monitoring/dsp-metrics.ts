/**
 * DSP Performance Monitoring
 * Implements ADR-0002: Web Worker DSP Architecture
 */

export interface DSPMetrics {
  avgProcessingTime: number;
  maxProcessingTime: number;
  minProcessingTime: number;
  throughput: number; // samples/second
  queueDepth: number;
  totalOperations: number;
}

class DSPPerformanceMonitor {
  private metrics: number[] = [];
  private maxSamples = 100;
  private totalOps = 0;
  private queueDepthValue = 0;

  /**
   * Record a processing time measurement
   * @param ms Processing time in milliseconds
   */
  recordProcessingTime(ms: number): void {
    this.metrics.push(ms);
    this.totalOps++;
    if (this.metrics.length > this.maxSamples) {
      this.metrics.shift();
    }
  }

  /**
   * Set current queue depth
   * @param depth Number of pending tasks
   */
  setQueueDepth(depth: number): void {
    this.queueDepthValue = depth;
  }

  /**
   * Get current performance metrics
   * @returns DSPMetrics object with current stats
   */
  getMetrics(): DSPMetrics {
    if (this.metrics.length === 0) {
      return {
        avgProcessingTime: 0,
        maxProcessingTime: 0,
        minProcessingTime: 0,
        throughput: 0,
        queueDepth: this.queueDepthValue,
        totalOperations: this.totalOps,
      };
    }

    return {
      avgProcessingTime:
        this.metrics.reduce((a, b) => a + b, 0) / this.metrics.length,
      maxProcessingTime: Math.max(...this.metrics),
      minProcessingTime: Math.min(...this.metrics),
      throughput: this.calculateThroughput(),
      queueDepth: this.queueDepthValue,
      totalOperations: this.totalOps,
    };
  }

  private calculateThroughput(): number {
    if (this.metrics.length === 0) {
      return 0;
    }
    const avgTime = this.metrics.reduce((a, b) => a + b, 0) / this.metrics.length;
    // Convert to operations per second
    return avgTime > 0 ? 1000 / avgTime : 0;
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics = [];
    this.totalOps = 0;
    this.queueDepthValue = 0;
  }
}

export const dspMetrics = new DSPPerformanceMonitor();
