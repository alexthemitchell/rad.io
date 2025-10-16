/**
 * Performance monitoring utilities using the Performance API and User Timing
 * Provides pipeline performance tracking, long task detection, and metrics visualization
 */

export interface PerformanceMetrics {
  name: string;
  duration: number;
  startTime: number;
  endTime: number;
  entryType: string;
}

export interface PipelineMetrics {
  fft: PerformanceMetrics[];
  waveform: PerformanceMetrics[];
  spectrogram: PerformanceMetrics[];
  rendering: PerformanceMetrics[];
  total: PerformanceMetrics[];
}

export interface LongTaskEntry {
  name: string;
  duration: number;
  startTime: number;
}

/**
 * Performance monitor class for tracking DSP and rendering pipeline
 */
class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetrics[]> = new Map();
  private longTasks: LongTaskEntry[] = [];
  private observer: PerformanceObserver | null = null;
  private enabled: boolean = true;

  constructor() {
    this.initializeObserver();
  }

  /**
   * Initialize PerformanceObserver for long task detection
   */
  private initializeObserver(): void {
    if (typeof PerformanceObserver === "undefined") {
      console.warn("PerformanceObserver not available in this environment");
      return;
    }

    try {
      // Monitor long tasks (>50ms)
      this.observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 50) {
            this.longTasks.push({
              name: entry.name,
              duration: entry.duration,
              startTime: entry.startTime,
            });

            // Keep only last 100 long tasks
            if (this.longTasks.length > 100) {
              this.longTasks.shift();
            }
          }
        }
      });

      // Observe measures and marks
      this.observer.observe({ entryTypes: ["measure", "mark"] });
    } catch (error) {
      console.warn("Could not initialize PerformanceObserver:", error);
    }
  }

  /**
   * Enable or disable performance monitoring
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if monitoring is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Mark the start of a performance measurement
   */
  mark(name: string): void {
    if (!this.enabled || typeof performance === "undefined") {
      return;
    }

    try {
      performance.mark(name);
    } catch (error) {
      console.warn(`Could not create performance mark '${name}':`, error);
    }
  }

  /**
   * Measure performance between two marks
   */
  measure(name: string, startMark: string, endMark?: string): void {
    if (!this.enabled || typeof performance === "undefined") {
      return;
    }

    try {
      // If no end mark, measure from start mark to now
      if (!endMark) {
        const uniqueSuffix = Date.now();
        const endMarkName = `${name}-end-${uniqueSuffix}`;
        performance.mark(endMarkName);
        endMark = endMarkName;
      }

      performance.measure(name, startMark, endMark);

      // Get the measurement
      const measures = performance.getEntriesByName(name, "measure");
      if (measures.length > 0) {
        const measure = measures[measures.length - 1] as PerformanceMeasure;
        const metric: PerformanceMetrics = {
          name: measure.name,
          duration: measure.duration,
          startTime: measure.startTime,
          endTime: measure.startTime + measure.duration,
          entryType: measure.entryType,
        };

        // Store metric by category
        const category = this.getCategory(name);
        if (!this.metrics.has(category)) {
          this.metrics.set(category, []);
        }
        this.metrics.get(category)!.push(metric);

        // Keep only last 100 measurements per category
        const categoryMetrics = this.metrics.get(category)!;
        if (categoryMetrics.length > 100) {
          categoryMetrics.shift();
        }
      }
    } catch (error) {
      console.warn(
        `Could not create performance measure '${name}' from '${startMark}' to '${endMark}':`,
        error,
      );
    }
  }

  /**
   * Get category from metric name
   */
  private getCategory(name: string): string {
    if (name.includes("fft")) {
      return "fft";
    }
    if (name.includes("waveform")) {
      return "waveform";
    }
    if (name.includes("spectrogram")) {
      return "spectrogram";
    }
    if (name.includes("render")) {
      return "rendering";
    }
    if (name.includes("pipeline")) {
      return "total";
    }
    return "other";
  }

  /**
   * Get metrics for a specific category
   */
  getMetrics(category: string): PerformanceMetrics[] {
    return this.metrics.get(category) || [];
  }

  /**
   * Get all pipeline metrics
   */
  getPipelineMetrics(): PipelineMetrics {
    return {
      fft: this.getMetrics("fft"),
      waveform: this.getMetrics("waveform"),
      spectrogram: this.getMetrics("spectrogram"),
      rendering: this.getMetrics("rendering"),
      total: this.getMetrics("total"),
    };
  }

  /**
   * Get detected long tasks
   */
  getLongTasks(): LongTaskEntry[] {
    return [...this.longTasks];
  }

  /**
   * Get average duration for a category
   */
  getAverageDuration(category: string): number {
    const metrics = this.getMetrics(category);
    if (metrics.length === 0) {
      return 0;
    }

    const sum = metrics.reduce((acc, m) => acc + m.duration, 0);
    return sum / metrics.length;
  }

  /**
   * Get statistics for a category
   */
  getStats(category: string): {
    count: number;
    avg: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
  } {
    const metrics = this.getMetrics(category);
    if (metrics.length === 0) {
      return {
        count: 0,
        avg: 0,
        min: 0,
        max: 0,
        p50: 0,
        p95: 0,
        p99: 0,
      };
    }

    const durations = metrics.map((m) => m.duration).sort((a, b) => a - b);
    const sum = durations.reduce((acc, d) => acc + d, 0);

    return {
      count: metrics.length,
      avg: sum / metrics.length,
      min: durations[0]!,
      max: durations[durations.length - 1]!,
      p50: durations[Math.min(Math.max(Math.ceil(durations.length * 0.5) - 1, 0), durations.length - 1)]!,
      p95: durations[Math.min(Math.max(Math.ceil(durations.length * 0.95) - 1, 0), durations.length - 1)]!,
      p99: durations[Math.min(Math.max(Math.ceil(durations.length * 0.99) - 1, 0), durations.length - 1)]!,
    };
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear();
    this.longTasks = [];

    if (typeof performance !== "undefined") {
      try {
        performance.clearMarks();
        performance.clearMeasures();
      } catch (error) {
        console.warn("Could not clear performance entries:", error);
      }
    }
  }

  /**
   * Export metrics for CI benchmarking
   */
  exportMetrics(): string {
    const stats = {
      fft: this.getStats("fft"),
      waveform: this.getStats("waveform"),
      spectrogram: this.getStats("spectrogram"),
      rendering: this.getStats("rendering"),
      total: this.getStats("total"),
      longTasks: {
        count: this.longTasks.length,
        tasks: this.longTasks.slice(0, 10), // Include up to 10 most recent
      },
    };

    return JSON.stringify(stats, null, 2);
  }

  /**
   * Log performance summary to console
   */
  logSummary(): void {
    // eslint-disable-next-line no-console
    console.group("Performance Summary");

    const categories = ["fft", "waveform", "spectrogram", "rendering", "total"];
    categories.forEach((category) => {
      const stats = this.getStats(category);
      if (stats.count > 0) {
        // eslint-disable-next-line no-console
        console.log(
          `${category.toUpperCase()}: avg=${stats.avg.toFixed(2)}ms, p95=${stats.p95.toFixed(2)}ms, count=${stats.count}`,
        );
      }
    });

    if (this.longTasks.length > 0) {
      console.warn(`Long tasks detected: ${this.longTasks.length}`);
      // eslint-disable-next-line no-console
      console.table(
        this.longTasks.slice(-5).map((t) => ({
          name: t.name,
          duration: `${t.duration.toFixed(2)}ms`,
          startTime: `${t.startTime.toFixed(2)}ms`,
        })),
      );
    }

    // eslint-disable-next-line no-console
    console.groupEnd();
  }

  /**
   * Cleanup observer
   */
  destroy(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.clear();
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * Decorator for measuring function performance
 */
export function measurePerformance<T extends (...args: unknown[]) => unknown>(
  name: string,
  fn: T,
): T {
  return ((...args: unknown[]) => {
    const startMark = `${name}-start-${Date.now()}`;
    performanceMonitor.mark(startMark);

    try {
      const result = fn(...args);

      // Handle async functions
      if (result instanceof Promise) {
        return result.finally(() => {
          performanceMonitor.measure(name, startMark);
        });
      }

      performanceMonitor.measure(name, startMark);
      return result;
    } catch (error) {
      performanceMonitor.measure(name, startMark);
      throw error;
    }
  }) as T;
}
