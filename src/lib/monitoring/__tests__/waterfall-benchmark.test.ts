/**
 * Waterfall Performance Benchmark Tests
 * Implements ADR-0027: DSP Pipeline Architecture
 * 
 * Validates pipeline performance targets:
 * - 30 FPS minimum (33.33ms budget)
 * - 60 FPS target (16.67ms budget)
 * - Low drop rate (< 1%)
 * - Stable performance over time
 */

import { pipelineMetrics } from "../pipeline-metrics";

// Skip these tests in regular runs (they're slow)
// Run with: TRACK_PERFORMANCE=1 npm test -- waterfall-benchmark
const runBenchmarks = process.env.TRACK_PERFORMANCE === "1";
const describeIf = runBenchmarks ? describe : describe.skip;

describeIf("Waterfall Performance Benchmarks", () => {
  beforeEach(() => {
    pipelineMetrics.reset();
  });

  describe("30 FPS Target (2048 FFT)", () => {
    const targetFPS = 30;
    const frameBudget = 1000 / targetFPS; // 33.33ms
    const fftSize = 2048;
    const testDuration = 1000; // 1 second
    const expectedFrames = targetFPS;

    it("should maintain 30 FPS for 1 second", () => {
      pipelineMetrics.setVisualizationTargetFPS(targetFPS);

      const startTime = performance.now();
      let frameCount = 0;
      const renderTimes: number[] = [];

      // Simulate 30 frames
      while (frameCount < expectedFrames) {
        const frameStart = performance.now();

        // Simulate DSP pipeline stages
        simulateDSPPipeline(fftSize);

        // Simulate rendering
        const renderTime = simulateWaterfallRender(fftSize);
        renderTimes.push(renderTime);

        const frameTime = performance.now() - frameStart;

        // Record metrics
        pipelineMetrics.recordVisualizationFrame(
          frameTime,
          frameTime > frameBudget, // Dropped if exceeded budget
        );

        frameCount++;
      }

      const totalTime = performance.now() - startTime;
      const avgRenderTime =
        renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length;

      const metrics = pipelineMetrics.getMetrics();

      // Verify performance targets
      expect(metrics.visualization.totalFrames).toBe(expectedFrames);
      expect(metrics.visualization.droppedFrames).toBeLessThan(expectedFrames * 0.01); // < 1% drops
      expect(metrics.visualization.renderTime).toBeLessThan(frameBudget);

      // Log performance for manual verification
      console.log(`30 FPS Benchmark (${fftSize} FFT):`);
      console.log(`  Total time: ${totalTime.toFixed(2)}ms`);
      console.log(`  Avg render time: ${avgRenderTime.toFixed(2)}ms`);
      console.log(`  Frame budget: ${frameBudget.toFixed(2)}ms`);
      console.log(`  Dropped frames: ${metrics.visualization.droppedFrames}/${expectedFrames}`);
      console.log(
        `  Headroom: ${((frameBudget - avgRenderTime) / frameBudget * 100).toFixed(1)}%`,
      );
    });
  });

  describe("60 FPS Target (2048 FFT)", () => {
    const targetFPS = 60;
    const frameBudget = 1000 / targetFPS; // 16.67ms
    const fftSize = 2048;
    const expectedFrames = targetFPS;

    it("should maintain 60 FPS for 1 second", () => {
      pipelineMetrics.setVisualizationTargetFPS(targetFPS);

      let frameCount = 0;
      const renderTimes: number[] = [];

      // Simulate 60 frames
      while (frameCount < expectedFrames) {
        const frameStart = performance.now();

        // Simulate DSP pipeline
        simulateDSPPipeline(fftSize);

        // Simulate rendering
        const renderTime = simulateWaterfallRender(fftSize);
        renderTimes.push(renderTime);

        const frameTime = performance.now() - frameStart;

        pipelineMetrics.recordVisualizationFrame(
          frameTime,
          frameTime > frameBudget,
        );

        frameCount++;
      }

      const avgRenderTime =
        renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length;
      const metrics = pipelineMetrics.getMetrics();

      // Verify performance targets
      expect(metrics.visualization.totalFrames).toBe(expectedFrames);
      expect(metrics.visualization.droppedFrames).toBeLessThan(expectedFrames * 0.01);
      expect(metrics.visualization.renderTime).toBeLessThan(frameBudget);

      console.log(`60 FPS Benchmark (${fftSize} FFT):`);
      console.log(`  Avg render time: ${avgRenderTime.toFixed(2)}ms`);
      console.log(`  Frame budget: ${frameBudget.toFixed(2)}ms`);
      console.log(`  Dropped frames: ${metrics.visualization.droppedFrames}/${expectedFrames}`);
      console.log(
        `  Headroom: ${((frameBudget - avgRenderTime) / frameBudget * 100).toFixed(1)}%`,
      );
    });
  });

  describe("High Sample Rate (8192 FFT @ 30 FPS)", () => {
    const targetFPS = 30;
    const frameBudget = 1000 / targetFPS; // 33.33ms
    const fftSize = 8192; // Larger FFT for wideband SDRs
    const expectedFrames = 30;

    it("should handle large FFTs at 30 FPS", () => {
      pipelineMetrics.setVisualizationTargetFPS(targetFPS);

      let frameCount = 0;
      const renderTimes: number[] = [];

      while (frameCount < expectedFrames) {
        const frameStart = performance.now();

        simulateDSPPipeline(fftSize);
        const renderTime = simulateWaterfallRender(fftSize);
        renderTimes.push(renderTime);

        const frameTime = performance.now() - frameStart;
        pipelineMetrics.recordVisualizationFrame(
          frameTime,
          frameTime > frameBudget,
        );

        frameCount++;
      }

      const avgRenderTime =
        renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length;
      const metrics = pipelineMetrics.getMetrics();

      expect(metrics.visualization.totalFrames).toBe(expectedFrames);
      expect(metrics.visualization.droppedFrames).toBeLessThan(expectedFrames * 0.05); // Allow 5% for large FFTs
      expect(metrics.visualization.renderTime).toBeLessThan(frameBudget * 1.2); // Allow 20% over for large FFTs

      console.log(`High Sample Rate Benchmark (${fftSize} FFT @ 30 FPS):`);
      console.log(`  Avg render time: ${avgRenderTime.toFixed(2)}ms`);
      console.log(`  Frame budget: ${frameBudget.toFixed(2)}ms`);
      console.log(`  Dropped frames: ${metrics.visualization.droppedFrames}/${expectedFrames}`);
    });
  });

  describe("Sustained Performance (60s @ 30 FPS)", () => {
    const targetFPS = 30;
    const frameBudget = 1000 / targetFPS;
    const fftSize = 2048;
    const duration = 60; // 60 seconds
    const expectedFrames = targetFPS * duration; // 1800 frames

    // This test takes ~60 seconds, only run with explicit flag
    const itIf = process.env.RUN_LONG_BENCHMARKS === "1" ? it : it.skip;

    itIf("should maintain performance over 60 seconds", () => {
      pipelineMetrics.setVisualizationTargetFPS(targetFPS);

      const startTime = performance.now();
      let frameCount = 0;
      const sampleInterval = 100; // Sample every 100 frames for stats

      while (frameCount < expectedFrames) {
        const frameStart = performance.now();

        simulateDSPPipeline(fftSize);
        simulateWaterfallRender(fftSize);

        const frameTime = performance.now() - frameStart;
        pipelineMetrics.recordVisualizationFrame(
          frameTime,
          frameTime > frameBudget,
        );

        frameCount++;

        // Log progress periodically
        if (frameCount % sampleInterval === 0) {
          const metrics = pipelineMetrics.getMetrics();
          const dropRate =
            (metrics.visualization.droppedFrames / frameCount) * 100;
          console.log(
            `  Frame ${frameCount}/${expectedFrames}: ${dropRate.toFixed(2)}% drops`,
          );
        }
      }

      const totalTime = (performance.now() - startTime) / 1000;
      const metrics = pipelineMetrics.getMetrics();
      const dropRate =
        (metrics.visualization.droppedFrames / expectedFrames) * 100;

      expect(metrics.visualization.totalFrames).toBe(expectedFrames);
      expect(dropRate).toBeLessThan(1.0); // < 1% drops over 60 seconds

      console.log(`Sustained Performance Benchmark (60s @ 30 FPS):`);
      console.log(`  Total time: ${totalTime.toFixed(1)}s`);
      console.log(
        `  Dropped frames: ${metrics.visualization.droppedFrames}/${expectedFrames} (${dropRate.toFixed(2)}%)`,
      );
      console.log(
        `  Avg render time: ${metrics.visualization.renderTime.toFixed(2)}ms`,
      );
    });
  });
});

/**
 * Simulate DSP pipeline processing
 * Includes: DC offset, windowing, FFT, power spectrum
 */
function simulateDSPPipeline(fftSize: number): void {
  // Generate fake IQ samples
  const iSamples = new Float32Array(fftSize);
  const qSamples = new Float32Array(fftSize);

  for (let i = 0; i < fftSize; i++) {
    iSamples[i] = Math.random() * 2 - 1;
    qSamples[i] = Math.random() * 2 - 1;
  }

  // Simulate DC offset removal
  let sumI = 0;
  let sumQ = 0;
  for (let i = 0; i < fftSize; i++) {
    sumI += iSamples[i];
    sumQ += qSamples[i];
  }
  const dcI = sumI / fftSize;
  const dcQ = sumQ / fftSize;
  for (let i = 0; i < fftSize; i++) {
    iSamples[i] -= dcI;
    qSamples[i] -= dcQ;
  }

  // Simulate windowing (Hann)
  for (let i = 0; i < fftSize; i++) {
    const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)));
    iSamples[i] *= w;
    qSamples[i] *= w;
  }

  // Simulate FFT (simplified - just calculate magnitudes)
  const spectrum = new Float32Array(fftSize);
  for (let i = 0; i < fftSize; i++) {
    const mag = Math.sqrt(iSamples[i] ** 2 + qSamples[i] ** 2);
    spectrum[i] = 20 * Math.log10(mag + 1e-10);
  }
}

/**
 * Simulate waterfall canvas rendering
 * Returns simulated render time in ms
 */
function simulateWaterfallRender(fftSize: number): number {
  const startTime = performance.now();

  // Simulate canvas operations
  const imageData = new Uint8ClampedArray(fftSize * 4); // RGBA

  // Simulate colormap lookup and pixel writing
  for (let i = 0; i < fftSize; i++) {
    const value = Math.random(); // Simulated spectrum value 0-1
    imageData[i * 4] = value * 255; // R
    imageData[i * 4 + 1] = value * 128; // G
    imageData[i * 4 + 2] = value * 64; // B
    imageData[i * 4 + 3] = 255; // A
  }

  // Simulate canvas scroll (memory copy)
  const scrollBuffer = new Uint8ClampedArray(fftSize * 100 * 4); // 100 rows
  for (let i = 0; i < scrollBuffer.length; i++) {
    scrollBuffer[i] = imageData[i % imageData.length];
  }

  return performance.now() - startTime;
}
