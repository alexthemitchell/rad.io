/**
 * FFT Worker Pool Implementation
 * Implements ADR-0012: Parallel FFT Worker Pool
 * 
 * Manages parallel FFT workers with priority-based scheduling and work-stealing
 */

import { FFTTask, FFTResult } from "../workers/types";
import { PriorityQueue } from "./priority-queue";

class FFTWorkerPool {
  private workers: Worker[] = [];
  private taskQueue: PriorityQueue<FFTTask>;
  private workerLoad: Map<Worker, number> = new Map();
  private pendingTasks = new Map<string, FFTTask>();

  constructor(size: number = navigator.hardwareConcurrency || 4) {
    this.taskQueue = new PriorityQueue<FFTTask>();
    this.initialize(size);
  }

  private initialize(size: number): void {
    for (let i = 0; i < size; i++) {
      try {
        const worker = new Worker(
          new URL("../workers/fft-worker.ts", import.meta.url),
          { type: "module" },
        );

        worker.onmessage = (e) => this.handleResult(worker, e.data);
        worker.onerror = (e) => this.handleError(e);

        this.workers.push(worker);
        this.workerLoad.set(worker, 0);
      } catch (error) {
        console.error("Failed to create FFT worker:", error);
      }
    }

    console.log(`FFT Worker Pool initialized with ${this.workers.length} workers`);
  }

  /**
   * Compute FFT for given samples with specified priority
   * @param samples IQ samples (interleaved I,Q format)
   * @param sampleRate Sample rate in Hz
   * @param priority Task priority (higher = more urgent)
   * @param fftSize FFT size (default: 2048)
   * @returns Promise resolving to FFT result
   */
  async computeFFT(
    samples: Float32Array,
    sampleRate: number,
    priority: number = 0,
    fftSize: number = 2048,
  ): Promise<FFTResult> {
    return new Promise((resolve, reject) => {
      const id = this.generateId();

      const task: FFTTask = {
        id,
        priority,
        samples,
        sampleRate,
        resolve,
        reject,
      };

      this.taskQueue.enqueue(task);
      this.pendingTasks.set(id, task);
      this.scheduleNext();
    });
  }

  /**
   * Schedule the next task to the least loaded worker
   */
  private scheduleNext(): void {
    if (this.taskQueue.isEmpty()) return;

    const worker = this.getLeastLoadedWorker();
    const task = this.taskQueue.dequeue();

    if (!task) return;

    // Transfer samples to worker
    worker.postMessage(
      {
        id: task.id,
        samples: task.samples,
        sampleRate: task.sampleRate,
      },
      [task.samples.buffer],
    );

    this.workerLoad.set(worker, (this.workerLoad.get(worker) || 0) + 1);
  }

  /**
   * Find the worker with the least load
   * @returns Worker with minimum load
   */
  private getLeastLoadedWorker(): Worker {
    let minLoad = Infinity;
    let leastLoaded = this.workers[0];

    for (const [worker, load] of this.workerLoad.entries()) {
      if (load < minLoad) {
        minLoad = load;
        leastLoaded = worker;
      }
    }

    return leastLoaded;
  }

  /**
   * Handle result from worker
   * @param worker Worker that completed the task
   * @param result FFT computation result
   */
  private handleResult(worker: Worker, result: FFTResult & { id: string }): void {
    // Decrement worker load
    this.workerLoad.set(
      worker,
      Math.max(0, (this.workerLoad.get(worker) || 0) - 1),
    );

    // Resolve the task
    const task = this.pendingTasks.get(result.id);
    if (task) {
      task.resolve({
        magnitude: result.magnitude,
        phase: result.phase,
        processingTime: result.processingTime,
      });
      this.pendingTasks.delete(result.id);
    }

    // Schedule next task
    this.scheduleNext();
  }

  /**
   * Handle worker errors
   * @param error Error event
   */
  private handleError(error: ErrorEvent): void {
    console.error("FFT Worker error:", error);
  }

  /**
   * Generate unique task ID
   * @returns Unique identifier string
   */
  private generateId(): string {
    return `fft-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current queue depth
   * @returns Number of pending tasks
   */
  getQueueDepth(): number {
    return this.taskQueue.size();
  }

  /**
   * Get worker load distribution
   * @returns Array of load values for each worker
   */
  getWorkerLoads(): number[] {
    return Array.from(this.workerLoad.values());
  }

  /**
   * Terminate all workers and clean up
   */
  terminate(): void {
    this.workers.forEach((worker) => worker.terminate());
    this.workers = [];
    this.workerLoad.clear();
    this.taskQueue.clear();
    this.pendingTasks.clear();
    console.log("FFT Worker Pool terminated");
  }
}

// Export singleton instance
export const fftWorkerPool = new FFTWorkerPool();
