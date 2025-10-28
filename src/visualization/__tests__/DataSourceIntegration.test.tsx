/**
 * Integration tests demonstrating how DataSources work with visualizations
 */

import { render } from "@testing-library/react";
import { type IQSample } from "../../models/SDRDevice";
import { type IQRecording } from "../../utils/iqRecorder";
import IQConstellation from "../components/IQConstellation";
import WaveformVisualizer from "../components/WaveformVisualizer";
import { ReplaySource } from "../ReplaySource";
import { SimulatedSource } from "../SimulatedSource";

describe("DataSource Integration with Visualizations", () => {
  /**
   * Create a small test recording
   */
  function createTestRecording(): IQRecording {
    const sampleRate = 2048000;
    const samples: IQSample[] = [];

    // Generate 1024 samples of a sine wave
    for (let i = 0; i < 1024; i++) {
      const t = i / sampleRate;
      const freq = 1000; // 1 kHz
      samples.push({
        I: Math.cos(2 * Math.PI * freq * t),
        Q: Math.sin(2 * Math.PI * freq * t),
      });
    }

    return {
      metadata: {
        sampleRate,
        frequency: 100e6,
        signalType: "FM",
        deviceName: "Test Device",
        timestamp: new Date().toISOString(),
        duration: samples.length / sampleRate,
        sampleCount: samples.length,
      },
      samples,
    };
  }

  describe("SimulatedSource with visualizations", () => {
    it("should feed samples to IQConstellation", (done) => {
      const source = new SimulatedSource({
        pattern: "sine",
        sampleRate: 2048000,
        samplesPerUpdate: 512,
      });

      void source.startStreaming((samples) => {
        expect(samples.length).toBeGreaterThan(0);

        // Render visualization with samples
        const { container } = render(
          <IQConstellation samples={samples} width={400} height={300} />,
        );

        const canvas = container.querySelector("canvas");
        expect(canvas).toBeInTheDocument();

        void source.stopStreaming().then(done);
      });
    });

    it("should feed samples to WaveformVisualizer", (done) => {
      const source = new SimulatedSource({
        pattern: "fm",
        sampleRate: 2048000,
        samplesPerUpdate: 512,
      });

      void source.startStreaming((samples) => {
        expect(samples.length).toBeGreaterThan(0);

        // Render visualization with samples
        const { container } = render(
          <WaveformVisualizer samples={samples} width={400} height={200} />,
        );

        const canvas = container.querySelector("canvas");
        expect(canvas).toBeInTheDocument();

        void source.stopStreaming().then(done);
      });
    });
  });

  describe("ReplaySource with visualizations", () => {
    it("should feed recorded samples to IQConstellation", (done) => {
      const recording = createTestRecording();
      const source = new ReplaySource(recording, 256);

      void source.startStreaming((samples) => {
        expect(samples.length).toBeGreaterThan(0);

        // Render visualization with samples
        const { container } = render(
          <IQConstellation samples={samples} width={400} height={300} />,
        );

        const canvas = container.querySelector("canvas");
        expect(canvas).toBeInTheDocument();

        void source.stopStreaming().then(done);
      });
    });

    it("should feed recorded samples to WaveformVisualizer", (done) => {
      const recording = createTestRecording();
      const source = new ReplaySource(recording, 256);

      void source.startStreaming((samples) => {
        expect(samples.length).toBeGreaterThan(0);

        // Render visualization with samples
        const { container } = render(
          <WaveformVisualizer samples={samples} width={400} height={200} />,
        );

        const canvas = container.querySelector("canvas");
        expect(canvas).toBeInTheDocument();

        void source.stopStreaming().then(done);
      });
    });

    it("should replay deterministically", async () => {
      const recording = createTestRecording();
      const source = new ReplaySource(recording, 512);

      const allSamples: IQSample[] = [];

      // Collect all samples from playback
      await new Promise<void>((resolve) => {
        void source.startStreaming((samples) => {
          allSamples.push(...samples);

          // When we've received all samples, stop
          if (allSamples.length >= recording.samples.length) {
            void source.stopStreaming().then(resolve);
          }
        });
      });

      expect(allSamples.length).toBe(1024);

      // Verify first few samples match the recording exactly
      for (let i = 0; i < 10; i++) {
        expect(allSamples[i]?.I).toBeCloseTo(recording.samples[i]?.I ?? 0);
        expect(allSamples[i]?.Q).toBeCloseTo(recording.samples[i]?.Q ?? 0);
      }
    });
  });

  describe("DataSource interface uniformity", () => {
    it("SimulatedSource and ReplaySource implement same interface", () => {
      const simulated = new SimulatedSource();
      const replay = new ReplaySource(createTestRecording());

      // Both should have same methods
      expect(typeof simulated.startStreaming).toBe("function");
      expect(typeof simulated.stopStreaming).toBe("function");
      expect(typeof simulated.isStreaming).toBe("function");
      expect(typeof simulated.getMetadata).toBe("function");

      expect(typeof replay.startStreaming).toBe("function");
      expect(typeof replay.stopStreaming).toBe("function");
      expect(typeof replay.isStreaming).toBe("function");
      expect(typeof replay.getMetadata).toBe("function");
    });

    it("both sources provide compatible metadata", async () => {
      const simulated = new SimulatedSource();
      const replay = new ReplaySource(createTestRecording());

      const simulatedMeta = await simulated.getMetadata();
      const replayMeta = await replay.getMetadata();

      expect(simulatedMeta.name).toBeDefined();
      expect(simulatedMeta.sampleRate).toBeDefined();
      expect(typeof simulatedMeta.sampleRate).toBe("number");

      expect(replayMeta.name).toBeDefined();
      expect(replayMeta.sampleRate).toBeDefined();
      expect(typeof replayMeta.sampleRate).toBe("number");
    });
  });
});
