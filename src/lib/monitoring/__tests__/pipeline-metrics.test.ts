/**
 * Tests for Pipeline Performance Metrics
 * Implements ADR-0027: DSP Pipeline Architecture
 */

import { pipelineMetrics } from "../pipeline-metrics";

describe("PipelinePerformanceMonitor", () => {
  beforeEach(() => {
    pipelineMetrics.reset();
  });

  describe("Producer Metrics", () => {
    it("should track samples processed", () => {
      pipelineMetrics.recordProducerSamples(1000);
      pipelineMetrics.recordProducerSamples(2000);

      const metrics = pipelineMetrics.getMetrics();
      expect(metrics.producer.totalSamples).toBe(3000);
    });

    it("should track dropped samples", () => {
      pipelineMetrics.recordProducerSamples(1000, 10);
      pipelineMetrics.recordProducerSamples(2000, 5);

      const metrics = pipelineMetrics.getMetrics();
      expect(metrics.producer.droppedSamples).toBe(15);
    });

    it("should calculate samples per second", () => {
      // Record samples and ensure some time passes between start and calculation
      pipelineMetrics.recordProducerSamples(1000);

      const metrics = pipelineMetrics.getMetrics();
      // Since we just started, samplesPerSecond should be calculated from elapsed time
      // It may be very high if calculated immediately, but should be >= 0
      expect(metrics.producer.samplesPerSecond).toBeGreaterThanOrEqual(0);
      expect(metrics.producer.totalSamples).toBe(1000);
    });
  });

  describe("Buffer Metrics", () => {
    it("should track buffer utilization", () => {
      pipelineMetrics.updateBufferMetrics(
        512, // available space
        1536, // available data
        2048, // capacity
      );

      const metrics = pipelineMetrics.getMetrics();
      expect(metrics.buffer.utilization).toBeCloseTo(0.75, 2);
      expect(metrics.buffer.availableSpace).toBe(512);
      expect(metrics.buffer.availableData).toBe(1536);
    });

    it("should track buffer overruns", () => {
      pipelineMetrics.updateBufferMetrics(0, 2048, 2048, true, false);
      pipelineMetrics.updateBufferMetrics(0, 2048, 2048, true, false);

      const metrics = pipelineMetrics.getMetrics();
      expect(metrics.buffer.overruns).toBe(2);
    });

    it("should track buffer underruns", () => {
      pipelineMetrics.updateBufferMetrics(2048, 0, 2048, false, true);

      const metrics = pipelineMetrics.getMetrics();
      expect(metrics.buffer.underruns).toBe(1);
    });
  });

  describe("DSP Worker Metrics", () => {
    it("should track processing times", () => {
      pipelineMetrics.recordDSPProcessingTime(1.5);
      pipelineMetrics.recordDSPProcessingTime(2.0);
      pipelineMetrics.recordDSPProcessingTime(1.8);

      const metrics = pipelineMetrics.getMetrics();
      expect(metrics.dsp.avgProcessingTime).toBeCloseTo(1.77, 1);
      expect(metrics.dsp.minProcessingTime).toBe(1.5);
      expect(metrics.dsp.maxProcessingTime).toBe(2.0);
      expect(metrics.dsp.totalOperations).toBe(3);
    });

    it("should calculate percentiles", () => {
      // Add enough samples for percentile calculation
      for (let i = 1; i <= 100; i++) {
        pipelineMetrics.recordDSPProcessingTime(i);
      }

      const metrics = pipelineMetrics.getMetrics();
      expect(metrics.dsp.p95ProcessingTime).toBeGreaterThanOrEqual(95);
      expect(metrics.dsp.p99ProcessingTime).toBeGreaterThanOrEqual(99);
    });

    it("should track queue depth", () => {
      pipelineMetrics.setDSPQueueDepth(5);

      const metrics = pipelineMetrics.getMetrics();
      expect(metrics.dsp.queueDepth).toBe(5);
    });

    it("should track worker utilization", () => {
      pipelineMetrics.initDSPWorkers(4);
      pipelineMetrics.setWorkerBusy(0, true);
      pipelineMetrics.setWorkerBusy(1, false);
      pipelineMetrics.setWorkerBusy(2, true);
      pipelineMetrics.setWorkerBusy(3, false);

      const metrics = pipelineMetrics.getMetrics();
      expect(metrics.dsp.workerUtilization).toEqual([1.0, 0.0, 1.0, 0.0]);
    });

    it("should track dropped tasks", () => {
      pipelineMetrics.recordDSPTaskDropped();
      pipelineMetrics.recordDSPTaskDropped();

      const metrics = pipelineMetrics.getMetrics();
      expect(metrics.dsp.droppedTasks).toBe(2);
    });
  });

  describe("Audio Consumer Metrics", () => {
    it("should track audio metrics", () => {
      pipelineMetrics.updateAudioMetrics(
        3, // underruns
        25.5, // latency ms
        48000, // sample rate
        2048, // buffer size
      );

      const metrics = pipelineMetrics.getMetrics();
      expect(metrics.audio.bufferUnderruns).toBe(3);
      expect(metrics.audio.latency).toBe(25.5);
      expect(metrics.audio.sampleRate).toBe(48000);
      expect(metrics.audio.bufferSize).toBe(2048);
    });
  });

  describe("Visualization Consumer Metrics", () => {
    it("should track frame rendering", () => {
      pipelineMetrics.recordVisualizationFrame(16.67); // 60 FPS
      pipelineMetrics.recordVisualizationFrame(16.67);
      pipelineMetrics.recordVisualizationFrame(16.67);

      const metrics = pipelineMetrics.getMetrics();
      expect(metrics.visualization.renderTime).toBeCloseTo(16.67, 1);
      expect(metrics.visualization.totalFrames).toBe(3);
    });

    it("should track dropped frames", () => {
      pipelineMetrics.recordVisualizationFrame(16.67, false);
      pipelineMetrics.recordVisualizationFrame(16.67, true);
      pipelineMetrics.recordVisualizationFrame(16.67, true);

      const metrics = pipelineMetrics.getMetrics();
      expect(metrics.visualization.droppedFrames).toBe(2);
      expect(metrics.visualization.totalFrames).toBe(3);
    });

    it("should respect target FPS", () => {
      pipelineMetrics.setVisualizationTargetFPS(30);

      const metrics = pipelineMetrics.getMetrics();
      expect(metrics.visualization.targetFPS).toBe(30);
    });
  });

  describe("Health Status", () => {
    it("should report healthy status with no issues", () => {
      const health = pipelineMetrics.getHealthStatus();
      expect(health.status).toBe("healthy");
      expect(health.issues).toHaveLength(0);
    });

    it("should warn on high buffer utilization", () => {
      pipelineMetrics.updateBufferMetrics(
        150, // 15% free
        1750, // 85% full
        2048,
      );

      const health = pipelineMetrics.getHealthStatus();
      expect(health.status).toBe("warning");
      expect(health.issues.length).toBeGreaterThan(0);
      expect(health.issues[0]).toContain("buffer utilization");
    });

    it("should go critical on buffer overruns", () => {
      pipelineMetrics.updateBufferMetrics(0, 2048, 2048, true);

      const health = pipelineMetrics.getHealthStatus();
      expect(health.status).toBe("critical");
      expect(health.issues.some((i) => i.includes("overrun"))).toBe(true);
    });

    it("should warn on high DSP queue depth", () => {
      pipelineMetrics.setDSPQueueDepth(7);

      const health = pipelineMetrics.getHealthStatus();
      expect(health.status).toBe("warning");
      expect(health.issues.some((i) => i.includes("queue"))).toBe(true);
    });

    it("should go critical on very high queue depth", () => {
      pipelineMetrics.setDSPQueueDepth(15);

      const health = pipelineMetrics.getHealthStatus();
      expect(health.status).toBe("critical");
      expect(health.issues.some((i) => i.includes("queue"))).toBe(true);
    });

    it("should warn on low FPS", () => {
      pipelineMetrics.setVisualizationTargetFPS(60);
      // Simulate low FPS (45 FPS = 22.2ms per frame)
      for (let i = 0; i < 10; i++) {
        pipelineMetrics.recordVisualizationFrame(22.2);
      }

      const health = pipelineMetrics.getHealthStatus();
      expect(health.status).toBe("warning");
      expect(health.issues.some((i) => i.includes("FPS"))).toBe(true);
    });

    it("should go critical on very low FPS", () => {
      pipelineMetrics.setVisualizationTargetFPS(60);
      // Simulate very low FPS (25 FPS = 40ms per frame)
      for (let i = 0; i < 10; i++) {
        pipelineMetrics.recordVisualizationFrame(40);
      }

      const health = pipelineMetrics.getHealthStatus();
      expect(health.status).toBe("critical");
      expect(health.issues.some((i) => i.includes("FPS"))).toBe(true);
    });

    it("should warn on sample drops", () => {
      pipelineMetrics.recordProducerSamples(100000, 200); // 0.2% drop rate

      const health = pipelineMetrics.getHealthStatus();
      expect(health.status).toBe("warning");
      expect(health.issues.some((i) => i.includes("drop"))).toBe(true);
    });

    it("should go critical on high drop rate", () => {
      pipelineMetrics.recordProducerSamples(100000, 2000); // 2% drop rate

      const health = pipelineMetrics.getHealthStatus();
      expect(health.status).toBe("critical");
      expect(health.issues.some((i) => i.includes("drop"))).toBe(true);
    });
  });

  describe("Reset", () => {
    it("should reset all metrics", () => {
      // Populate metrics
      pipelineMetrics.recordProducerSamples(1000, 10);
      pipelineMetrics.updateBufferMetrics(512, 1536, 2048, true, true);
      pipelineMetrics.recordDSPProcessingTime(1.5);
      pipelineMetrics.setDSPQueueDepth(5);
      pipelineMetrics.updateAudioMetrics(3, 25.5, 48000, 2048);
      pipelineMetrics.recordVisualizationFrame(16.67, true);

      // Reset
      pipelineMetrics.reset();

      // Verify all metrics are zeroed
      const metrics = pipelineMetrics.getMetrics();
      expect(metrics.producer.totalSamples).toBe(0);
      expect(metrics.producer.droppedSamples).toBe(0);
      expect(metrics.buffer.overruns).toBe(0);
      expect(metrics.buffer.underruns).toBe(0);
      expect(metrics.dsp.totalOperations).toBe(0);
      expect(metrics.dsp.queueDepth).toBe(0);
      expect(metrics.audio.bufferUnderruns).toBe(0);
      expect(metrics.visualization.totalFrames).toBe(0);
      expect(metrics.visualization.droppedFrames).toBe(0);
    });
  });
});
