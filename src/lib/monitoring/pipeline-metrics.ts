/**
 * Comprehensive DSP Pipeline Metrics
 * Implements ADR-0027: DSP Pipeline Architecture
 * 
 * Tracks metrics at each stage:
 * - Producer (SDR device acquisition)
 * - Buffer (SharedRingBuffer utilization)
 * - DSP Workers (processing time, queue depth)
 * - Consumers (audio, visualization)
 */

export interface ProducerMetrics {
  samplesPerSecond: number;
  bufferUtilization: number; // 0-1
  droppedSamples: number;
  totalSamples: number;
}

export interface BufferMetrics {
  availableSpace: number; // bytes
  availableData: number; // bytes
  utilization: number; // 0-1
  overruns: number;
  underruns: number;
}

export interface DSPWorkerMetrics {
  avgProcessingTime: number; // ms
  maxProcessingTime: number; // ms
  minProcessingTime: number; // ms
  p95ProcessingTime: number; // ms
  p99ProcessingTime: number; // ms
  queueDepth: number;
  workerUtilization: number[]; // per-worker utilization (0-1)
  totalOperations: number;
  droppedTasks: number;
}

export interface AudioConsumerMetrics {
  bufferUnderruns: number;
  latency: number; // ms
  sampleRate: number;
  bufferSize: number;
}

export interface VisualizationConsumerMetrics {
  actualFPS: number;
  targetFPS: number;
  droppedFrames: number;
  totalFrames: number;
  renderTime: number; // ms per frame
}

export interface PipelineMetrics {
  producer: ProducerMetrics;
  buffer: BufferMetrics;
  dsp: DSPWorkerMetrics;
  audio: AudioConsumerMetrics;
  visualization: VisualizationConsumerMetrics;
  timestamp: number;
}

/**
 * Comprehensive pipeline performance monitor
 * Tracks metrics at each stage of the DSP pipeline
 */
class PipelinePerformanceMonitor {
  // Producer metrics
  private producerSamplesProcessed = 0;
  private producerDroppedSamples = 0;
  private producerStartTime = Date.now();
  private producerLastUpdateTime = Date.now();
  
  // Buffer metrics
  private bufferOverruns = 0;
  private bufferUnderruns = 0;
  private bufferAvailableSpace = 0;
  private bufferAvailableData = 0;
  private bufferCapacity = 0;
  
  // DSP worker metrics
  private dspProcessingTimes: number[] = [];
  private dspQueueDepth = 0;
  private dspWorkerCount = 0;
  private dspWorkerBusy: boolean[] = [];
  private dspTotalOps = 0;
  private dspDroppedTasks = 0;
  private maxSamples = 200; // Increased for better percentile accuracy
  
  // Audio consumer metrics
  private audioUnderruns = 0;
  private audioLatency = 0;
  private audioSampleRate = 48000;
  private audioBufferSize = 2048;
  
  // Visualization consumer metrics
  private vizFrameTimes: number[] = [];
  private vizDroppedFrames = 0;
  private vizTotalFrames = 0;
  private vizTargetFPS = 60;
  private vizLastFrameTime = Date.now();
  private maxFrameSamples = 60; // 1 second of frames at 60 FPS

  /**
   * Record producer metrics
   */
  recordProducerSamples(count: number, dropped = 0): void {
    this.producerSamplesProcessed += count;
    this.producerDroppedSamples += dropped;
    this.producerLastUpdateTime = Date.now();
  }

  /**
   * Update buffer metrics
   */
  updateBufferMetrics(
    availableSpace: number,
    availableData: number,
    capacity: number,
    overrun = false,
    underrun = false,
  ): void {
    this.bufferAvailableSpace = availableSpace;
    this.bufferAvailableData = availableData;
    this.bufferCapacity = capacity;
    if (overrun) this.bufferOverruns++;
    if (underrun) this.bufferUnderruns++;
  }

  /**
   * Record DSP processing time
   */
  recordDSPProcessingTime(ms: number): void {
    this.dspProcessingTimes.push(ms);
    this.dspTotalOps++;
    
    // Keep only recent samples for percentile calculation
    if (this.dspProcessingTimes.length > this.maxSamples) {
      this.dspProcessingTimes.shift();
    }
  }

  /**
   * Update DSP queue depth
   */
  setDSPQueueDepth(depth: number): void {
    this.dspQueueDepth = depth;
  }

  /**
   * Initialize DSP worker tracking
   */
  initDSPWorkers(count: number): void {
    this.dspWorkerCount = count;
    this.dspWorkerBusy = new Array(count).fill(false);
  }

  /**
   * Mark worker as busy/idle
   */
  setWorkerBusy(workerIndex: number, busy: boolean): void {
    if (workerIndex >= 0 && workerIndex < this.dspWorkerBusy.length) {
      this.dspWorkerBusy[workerIndex] = busy;
    }
  }

  /**
   * Record dropped DSP task
   */
  recordDSPTaskDropped(): void {
    this.dspDroppedTasks++;
  }

  /**
   * Update audio consumer metrics
   */
  updateAudioMetrics(
    underruns: number,
    latency: number,
    sampleRate: number,
    bufferSize: number,
  ): void {
    this.audioUnderruns = underruns;
    this.audioLatency = latency;
    this.audioSampleRate = sampleRate;
    this.audioBufferSize = bufferSize;
  }

  /**
   * Record visualization frame
   */
  recordVisualizationFrame(renderTime: number, dropped = false): void {
    const now = Date.now();
    const actualFPS = 1000 / (now - this.vizLastFrameTime);
    this.vizLastFrameTime = now;
    
    this.vizFrameTimes.push(renderTime);
    this.vizTotalFrames++;
    
    if (dropped) {
      this.vizDroppedFrames++;
    }
    
    // Keep only recent frame times
    if (this.vizFrameTimes.length > this.maxFrameSamples) {
      this.vizFrameTimes.shift();
    }
  }

  /**
   * Set target visualization FPS
   */
  setVisualizationTargetFPS(fps: number): void {
    this.vizTargetFPS = fps;
  }

  /**
   * Calculate percentile from sorted array
   */
  private calculatePercentile(sorted: number[], percentile: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)] ?? 0;
  }

  /**
   * Get complete pipeline metrics
   */
  getMetrics(): PipelineMetrics {
    const now = Date.now();
    const elapsedSeconds = (now - this.producerStartTime) / 1000;
    const recentSeconds = (now - this.producerLastUpdateTime) / 1000;
    
    // Calculate producer metrics
    const samplesPerSecond =
      recentSeconds > 0 ? this.producerSamplesProcessed / elapsedSeconds : 0;
    const bufferUtilization =
      this.bufferCapacity > 0
        ? this.bufferAvailableData / this.bufferCapacity
        : 0;

    // Calculate DSP metrics
    const sortedTimes = [...this.dspProcessingTimes].sort((a, b) => a - b);
    const avgDSPTime =
      sortedTimes.length > 0
        ? sortedTimes.reduce((a, b) => a + b, 0) / sortedTimes.length
        : 0;
    const workerUtilization = this.dspWorkerBusy.map((busy) =>
      busy ? 1.0 : 0.0,
    );

    // Calculate visualization metrics
    const avgFrameTime =
      this.vizFrameTimes.length > 0
        ? this.vizFrameTimes.reduce((a, b) => a + b, 0) /
          this.vizFrameTimes.length
        : 0;
    const actualFPS =
      this.vizFrameTimes.length > 0 && avgFrameTime > 0
        ? 1000 / avgFrameTime
        : 0;

    return {
      producer: {
        samplesPerSecond,
        bufferUtilization,
        droppedSamples: this.producerDroppedSamples,
        totalSamples: this.producerSamplesProcessed,
      },
      buffer: {
        availableSpace: this.bufferAvailableSpace,
        availableData: this.bufferAvailableData,
        utilization:
          this.bufferCapacity > 0
            ? this.bufferAvailableData / this.bufferCapacity
            : 0,
        overruns: this.bufferOverruns,
        underruns: this.bufferUnderruns,
      },
      dsp: {
        avgProcessingTime: avgDSPTime,
        maxProcessingTime:
          sortedTimes.length > 0 ? sortedTimes[sortedTimes.length - 1]! : 0,
        minProcessingTime: sortedTimes.length > 0 ? sortedTimes[0]! : 0,
        p95ProcessingTime: this.calculatePercentile(sortedTimes, 95),
        p99ProcessingTime: this.calculatePercentile(sortedTimes, 99),
        queueDepth: this.dspQueueDepth,
        workerUtilization,
        totalOperations: this.dspTotalOps,
        droppedTasks: this.dspDroppedTasks,
      },
      audio: {
        bufferUnderruns: this.audioUnderruns,
        latency: this.audioLatency,
        sampleRate: this.audioSampleRate,
        bufferSize: this.audioBufferSize,
      },
      visualization: {
        actualFPS,
        targetFPS: this.vizTargetFPS,
        droppedFrames: this.vizDroppedFrames,
        totalFrames: this.vizTotalFrames,
        renderTime: avgFrameTime,
      },
      timestamp: now,
    };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.producerSamplesProcessed = 0;
    this.producerDroppedSamples = 0;
    this.producerStartTime = Date.now();
    this.producerLastUpdateTime = Date.now();
    
    this.bufferOverruns = 0;
    this.bufferUnderruns = 0;
    this.bufferAvailableSpace = 0;
    this.bufferAvailableData = 0;
    this.bufferCapacity = 0;
    
    this.dspProcessingTimes = [];
    this.dspQueueDepth = 0;
    this.dspWorkerBusy = new Array(this.dspWorkerCount).fill(false);
    this.dspTotalOps = 0;
    this.dspDroppedTasks = 0;
    
    this.audioUnderruns = 0;
    this.audioLatency = 0;
    
    this.vizFrameTimes = [];
    this.vizDroppedFrames = 0;
    this.vizTotalFrames = 0;
    this.vizLastFrameTime = Date.now();
  }

  /**
   * Get health status based on metrics
   */
  getHealthStatus(): {
    status: "healthy" | "warning" | "critical";
    issues: string[];
  } {
    const metrics = this.getMetrics();
    const issues: string[] = [];
    let status: "healthy" | "warning" | "critical" = "healthy";

    // Check producer health
    if (metrics.producer.droppedSamples > 0) {
      const dropRate =
        metrics.producer.droppedSamples / metrics.producer.totalSamples;
      if (dropRate > 0.01) {
        // > 1% drop rate
        status = "critical";
        issues.push(
          `High sample drop rate: ${(dropRate * 100).toFixed(1)}%`,
        );
      } else if (dropRate > 0.001) {
        // > 0.1% drop rate
        if (status === "healthy") status = "warning";
        issues.push(
          `Sample drops detected: ${(dropRate * 100).toFixed(2)}%`,
        );
      }
    }

    // Check buffer health
    if (metrics.buffer.utilization > 0.95) {
      status = "critical";
      issues.push(
        `Buffer nearly full: ${(metrics.buffer.utilization * 100).toFixed(0)}%`,
      );
    } else if (metrics.buffer.utilization > 0.85) {
      if (status === "healthy") status = "warning";
      issues.push(
        `High buffer utilization: ${(metrics.buffer.utilization * 100).toFixed(0)}%`,
      );
    }

    if (metrics.buffer.overruns > 0) {
      status = "critical";
      issues.push(`Buffer overruns: ${metrics.buffer.overruns}`);
    }

    // Check DSP health
    if (metrics.dsp.queueDepth > 10) {
      status = "critical";
      issues.push(`DSP queue backed up: ${metrics.dsp.queueDepth} tasks`);
    } else if (metrics.dsp.queueDepth > 5) {
      if (status === "healthy") status = "warning";
      issues.push(`DSP queue depth: ${metrics.dsp.queueDepth}`);
    }

    if (metrics.dsp.droppedTasks > 0) {
      status = "critical";
      issues.push(`DSP tasks dropped: ${metrics.dsp.droppedTasks}`);
    }

    // Check visualization health (only if frames have been recorded)
    if (metrics.visualization.totalFrames > 0) {
      const fpsRatio = metrics.visualization.actualFPS / metrics.visualization.targetFPS;
      if (!isNaN(fpsRatio) && fpsRatio < 0.5) {
        status = "critical";
        issues.push(
          `Low FPS: ${metrics.visualization.actualFPS.toFixed(1)}/${metrics.visualization.targetFPS}`,
        );
      } else if (!isNaN(fpsRatio) && fpsRatio < 0.8) {
        if (status === "healthy") status = "warning";
        issues.push(
          `Below target FPS: ${metrics.visualization.actualFPS.toFixed(1)}/${metrics.visualization.targetFPS}`,
        );
      }

      const dropRate =
        metrics.visualization.droppedFrames / metrics.visualization.totalFrames;
      if (!isNaN(dropRate) && dropRate > 0.05) {
        // > 5% drops
        status = "critical";
        issues.push(
          `High frame drop rate: ${(dropRate * 100).toFixed(1)}%`,
        );
      } else if (!isNaN(dropRate) && dropRate > 0.01) {
        // > 1% drops
        if (status === "healthy") status = "warning";
        issues.push(`Frame drops: ${(dropRate * 100).toFixed(2)}%`);
      }
    }

    return { status, issues };
  }
}

// Export singleton instance
export const pipelineMetrics = new PipelinePerformanceMonitor();
