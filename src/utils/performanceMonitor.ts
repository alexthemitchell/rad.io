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
  private metrics = new Map<string, PerformanceMetrics[]>();
  private longTasks: LongTaskEntry[] = [];
  private observer: PerformanceObserver | null = null;
  private enabled = true;

  constructor() {
    this.initializeObserver();
  }

  /**
   * Initialize PerformanceObserver for long task detection
   */
  private initializeObserver(): void {
    if (typeof PerformanceObserver === "undefined") {
      // Not available in this environment (e.g., Node/JSDOM). Silently skip.
      return;
    }

    try {
      // Monitor measures/marks and true long tasks (>50ms). We observe both to
      // keep our own metric store up-to-date while also capturing browser long tasks.
      this.observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          // Only record actual "longtask" entries for long task reporting
          if (entry.entryType === "longtask" && entry.duration > 50) {
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

      // Observe long tasks plus measures/marks for completeness
      this.observer.observe({ entryTypes: ["measure", "mark", "longtask"] });
    } catch {
      // Silently skip observer initialization failures
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
    if (
      !this.enabled ||
      typeof performance === "undefined" ||
      typeof performance.mark !== "function"
    ) {
      return;
    }

    // Fail silently if marking isn't supported
    try {
      performance.mark(name);
    } catch {
      // no-op
    }
  }

  /**
   * Measure performance between two marks
   */
  measure(name: string, startMark: string, endMark?: string): void {
    if (
      !this.enabled ||
      typeof performance === "undefined" ||
      typeof performance.mark !== "function" ||
      typeof performance.measure !== "function" ||
      typeof performance.getEntriesByName !== "function"
    ) {
      return;
    }

    try {
      // If no end mark, measure from start mark to now
      let finalEndMark = endMark;
      if (!finalEndMark) {
        const uniqueSuffix = Date.now();
        const endMarkName = `${name}-end-${uniqueSuffix}`;
        performance.mark(endMarkName);
        finalEndMark = endMarkName;
      }

      performance.measure(name, startMark, finalEndMark);

      // Get the latest measurement
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
        const categoryMetrics = this.metrics.get(category);
        if (categoryMetrics) {
          categoryMetrics.push(metric);

          // Keep only last 100 measurements per category
          if (categoryMetrics.length > 100) {
            categoryMetrics.shift();
          }
        }
      }

      // Clear marks and measures to avoid unbounded growth in Performance timeline
      try {
        performance.clearMarks(finalEndMark);
      } catch {}
      try {
        performance.clearMarks(startMark);
      } catch {}
      try {
        performance.clearMeasures(name);
      } catch {}
    } catch {
      // no-op
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
    return this.metrics.get(category) ?? [];
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
   * Get estimated frames per second from the 'rendering' category.
   * Uses average render duration: fps = 1000 / avg(ms), rounded to 1 decimal.
   */
  getFPS(): number {
    // Prefer cadence-based FPS using intervals between successive 'rendering' measures
    const metrics = this.getMetrics("rendering");
    if (metrics.length >= 2) {
      // Use up to the last 60 intervals for stability
      const deltas: number[] = [];
      const start = Math.max(1, metrics.length - 60);
      for (let i = start; i < metrics.length; i++) {
        const prev = metrics[i - 1];
        const curr = metrics[i];
        if (!prev || !curr) {
          continue;
        }
        const dt = curr.startTime - prev.startTime;
        if (isFinite(dt) && dt > 0) {
          deltas.push(dt);
        }
      }
      if (deltas.length > 0) {
        const sum = deltas.reduce((a, b) => a + b, 0);
        const avgDt = sum / deltas.length;
        const fps = 1000 / avgDt;
        if (isFinite(fps) && fps > 0) {
          return Math.round(fps * 10) / 10;
        }
      }
    }

    // Fallback to throughput-based FPS using average render duration
    const avg = this.getAverageDuration("rendering");
    if (!avg || avg <= 0 || !isFinite(avg)) {
      return 0;
    }
    const fps = 1000 / avg;
    return Math.round(fps * 10) / 10;
  }

  /**
   * Compute cadence-based FPS for a specific performance measure name by
   * analyzing intervals between successive measurements' start times.
   * Uses up to the last `windowCount` intervals for stability.
   */
  getCadenceFPS(name: string, windowCount = 60): number {
    // Compute cadence using our stored metrics that match the exact name
    const all: PerformanceMetrics[] = [];
    for (const arr of this.metrics.values()) {
      for (const m of arr) {
        if (m.name === name) {
          all.push(m);
        }
      }
    }
    if (all.length < 2) {
      return 0;
    }
    const startIdx = Math.max(1, all.length - windowCount);
    const deltas: number[] = [];
    for (let i = startIdx; i < all.length; i++) {
      const prev = all[i - 1];
      const curr = all[i];
      if (prev && curr) {
        const dt = curr.startTime - prev.startTime;
        if (isFinite(dt) && dt > 0) {
          deltas.push(dt);
        }
      }
    }
    if (deltas.length === 0) {
      return 0;
    }
    const avgDt = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    const fps = 1000 / avgDt;
    return isFinite(fps) && fps > 0 ? Math.round(fps * 10) / 10 : 0;
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

    const firstDuration = durations[0];
    const lastDuration = durations[durations.length - 1];
    const p50Index = Math.min(
      Math.max(Math.ceil(durations.length * 0.5) - 1, 0),
      durations.length - 1,
    );
    const p95Index = Math.min(
      Math.max(Math.ceil(durations.length * 0.95) - 1, 0),
      durations.length - 1,
    );
    const p99Index = Math.min(
      Math.max(Math.ceil(durations.length * 0.99) - 1, 0),
      durations.length - 1,
    );

    if (
      firstDuration === undefined ||
      lastDuration === undefined ||
      durations[p50Index] === undefined ||
      durations[p95Index] === undefined ||
      durations[p99Index] === undefined
    ) {
      // Shouldn't happen but guard against it
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

    return {
      count: metrics.length,
      avg: sum / metrics.length,
      min: firstDuration,
      max: lastDuration,
      p50: durations[p50Index],
      p95: durations[p95Index],
      p99: durations[p99Index],
    };
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear();
    this.longTasks = [];

    if (
      typeof performance !== "undefined" &&
      typeof performance.clearMarks === "function" &&
      typeof performance.clearMeasures === "function"
    ) {
      try {
        performance.clearMarks();
        performance.clearMeasures();
      } catch {
        // no-op
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
// Module-level counter for unique mark names
let performanceMarkCounter = 0;

export function measurePerformance<T extends (...args: unknown[]) => unknown>(
  name: string,
  fn: T,
): T {
  return ((...args: unknown[]) => {
    const counter = performanceMarkCounter++;
    const now =
      typeof performance !== "undefined" &&
      typeof performance.now === "function"
        ? performance.now()
        : Date.now();
    const startMark = `${name}-start-${now}-${counter}`;
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
