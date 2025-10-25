/**
 * DSP Worker Pool Implementation
 * Implements ADR-0002: Web Worker DSP Architecture
 * 
 * Manages a pool of Web Workers for parallel DSP processing
 */

import { dspMetrics } from "../monitoring/dsp-metrics";
import type { DSPMessage, DSPResponse } from "./types";

class DSPWorkerPool {
  private workers: Worker[] = [];
  private pendingTasks = new Map<string, (result: DSPResponse) => void>();
  private nextWorkerIndex = 0;

  constructor(
    poolSize: number = Math.min(4, navigator.hardwareConcurrency || 2),
  ) {
    this.initialize(poolSize);
  }

  private initialize(poolSize: number): void {
    // Create worker pool
    for (let i = 0; i < poolSize; i++) {
      try {
        const worker = new Worker(
          new URL("./dsp-worker.ts", import.meta.url),
          { type: "module" },
        );

        worker.onmessage = (e: MessageEvent<DSPResponse>): void =>
          this.handleWorkerMessage(e.data);
        worker.onerror = (e: ErrorEvent): void => this.handleWorkerError(e);

        this.workers.push(worker);
      } catch (error) {
        console.error("Failed to create DSP worker:", error);
      }
    }

    console.info(`DSP Worker Pool initialized with ${this.workers.length} workers`);
  }

  /**
   * Process a DSP operation using the worker pool
   * @param message DSP operation message
   * @returns Promise resolving to DSP response
   */
  async process(message: DSPMessage): Promise<DSPResponse> {
    return new Promise((resolve, reject) => {
      if (this.workers.length === 0) {
        reject(new Error("No workers available"));
        return;
      }

      this.pendingTasks.set(message.id, resolve);
      dspMetrics.setQueueDepth(this.pendingTasks.size);

      const worker = this.getNextWorker();

      // Use transferable objects to avoid copying
      const transferables: Transferable[] = [message.samples.buffer];
      worker.postMessage(message, transferables);
    });
  }

  /**
   * Get the next worker using round-robin scheduling
   * @returns Next worker in the pool
   */
  private getNextWorker(): Worker {
    const worker = this.workers[this.nextWorkerIndex];
    if (!worker) {
      throw new Error("No workers available");
    }
    this.nextWorkerIndex = (this.nextWorkerIndex + 1) % this.workers.length;
    return worker;
  }

  /**
   * Handle response from worker
   * @param response DSP operation response
   */
  private handleWorkerMessage(response: DSPResponse): void {
    const resolver = this.pendingTasks.get(response.id);
    if (resolver) {
      // Record metrics
      dspMetrics.recordProcessingTime(response.processingTime);
      dspMetrics.setQueueDepth(this.pendingTasks.size - 1);

      resolver(response);
      this.pendingTasks.delete(response.id);
    }
  }

  /**
   * Handle worker errors
   * @param error Error event from worker
   */
  private handleWorkerError(error: ErrorEvent): void {
    console.error("DSP Worker error:", error);
  }

  /**
   * Terminate all workers and clean up
   */
  terminate(): void {
    this.workers.forEach((worker) => worker.terminate());
    this.workers = [];
    this.pendingTasks.clear();
    console.info("DSP Worker Pool terminated");
  }

  /**
   * Get the number of workers in the pool
   * @returns Worker count
   */
  getWorkerCount(): number {
    return this.workers.length;
  }

  /**
   * Get the number of pending tasks
   * @returns Pending task count
   */
  getPendingTaskCount(): number {
    return this.pendingTasks.size;
  }
}

// Export singleton instance
export const dspWorkerPool = new DSPWorkerPool();
