import { AGCProcessor } from "../AGCProcessor";
import type { Sample } from "../../../utils/dsp";

/**
 * Generate samples with specific amplitude
 */
function generateSamplesWithAmplitude(
  amplitude: number,
  numSamples: number,
): Sample[] {
  const samples: Sample[] = [];
  for (let i = 0; i < numSamples; i++) {
    const phase = (2 * Math.PI * i) / numSamples;
    samples.push({
      I: amplitude * Math.cos(phase),
      Q: amplitude * Math.sin(phase),
    });
  }
  return samples;
}

/**
 * Calculate RMS amplitude of samples
 */
function calculateRMS(samples: Sample[]): number {
  let sumSquared = 0;
  for (const sample of samples) {
    sumSquared += sample.I * sample.I + sample.Q * sample.Q;
  }
  return Math.sqrt(sumSquared / (samples.length * 2));
}

describe("AGCProcessor", () => {
  const defaultConfig = {
    type: "agc" as const,
    targetLevel: 0.7,
    attackTime: 0.01,
    decayTime: 0.1,
    maxGain: 10.0,
  };

  describe("constructor", () => {
    it("should create processor with valid config", () => {
      const processor = new AGCProcessor(defaultConfig);

      expect(processor).toBeInstanceOf(AGCProcessor);
      const config = processor.getConfig();
      expect(config.targetLevel).toBe(0.7);
      expect(config.maxGain).toBe(10.0);
    });

    it("should throw error for invalid targetLevel", () => {
      expect(
        () =>
          new AGCProcessor({
            ...defaultConfig,
            targetLevel: 1.5, // > 1.0
          }),
      ).toThrow("targetLevel must be between 0 and 1.0");

      expect(
        () =>
          new AGCProcessor({
            ...defaultConfig,
            targetLevel: 0, // <= 0
          }),
      ).toThrow("targetLevel must be between 0 and 1.0");
    });

    it("should throw error for non-positive attackTime", () => {
      expect(
        () =>
          new AGCProcessor({
            ...defaultConfig,
            attackTime: 0,
          }),
      ).toThrow("attackTime must be positive");
    });

    it("should throw error for non-positive decayTime", () => {
      expect(
        () =>
          new AGCProcessor({
            ...defaultConfig,
            decayTime: -0.1,
          }),
      ).toThrow("decayTime must be positive");
    });

    it("should throw error for maxGain <= 1.0", () => {
      expect(
        () =>
          new AGCProcessor({
            ...defaultConfig,
            maxGain: 1.0,
          }),
      ).toThrow("maxGain must be greater than 1.0");
    });
  });

  describe("process", () => {
    it("should process samples and return AGC output", () => {
      const processor = new AGCProcessor(defaultConfig);
      const samples = generateSamplesWithAmplitude(0.5, 1024);

      const output = processor.process(samples);

      expect(output.samples).toHaveLength(samples.length);
      expect(output.currentGain).toBeGreaterThan(0);
      expect(typeof output.currentGain).toBe("number");
    });

    it("should handle empty samples", () => {
      const processor = new AGCProcessor(defaultConfig);

      const output = processor.process([]);

      expect(output.samples).toHaveLength(0);
      expect(output.currentGain).toBeGreaterThan(0);
    });

    it("should amplify weak signals", () => {
      const processor = new AGCProcessor(defaultConfig);
      const weakSignal = generateSamplesWithAmplitude(0.1, 1024);

      // Process multiple times to let AGC settle
      let output;
      for (let i = 0; i < 10; i++) {
        output = processor.process(weakSignal);
      }

      // Output should be closer to target level than input
      const inputRMS = calculateRMS(weakSignal);
      const outputRMS = calculateRMS(output!.samples);

      expect(outputRMS).toBeGreaterThan(inputRMS);
      expect(output!.currentGain).toBeGreaterThan(1.0);
    });

    it("should process strong signals without error", () => {
      const processor = new AGCProcessor(defaultConfig);
      const strongSignal = generateSamplesWithAmplitude(0.95, 1024);

      // Process multiple times to let AGC settle
      let output;
      for (let i = 0; i < 10; i++) {
        output = processor.process(strongSignal);
      }

      // Should produce valid output
      expect(output!.samples).toHaveLength(strongSignal.length);
      expect(output!.currentGain).toBeGreaterThan(0);
    });

    it("should respect maxGain limit", () => {
      const processor = new AGCProcessor({
        ...defaultConfig,
        maxGain: 2.0,
      });

      const veryWeakSignal = generateSamplesWithAmplitude(0.01, 1024);

      // Process many times to try to exceed maxGain
      for (let i = 0; i < 100; i++) {
        const output = processor.process(veryWeakSignal);
        expect(output.currentGain).toBeLessThanOrEqual(2.0);
      }
    });

    it("should maintain minimum gain", () => {
      const processor = new AGCProcessor(defaultConfig);
      const veryStrongSignal = generateSamplesWithAmplitude(1.0, 1024);

      // Process many times
      for (let i = 0; i < 100; i++) {
        const output = processor.process(veryStrongSignal);
        expect(output.currentGain).toBeGreaterThanOrEqual(0.1);
      }
    });
  });

  describe("config management", () => {
    it("should return config copy", () => {
      const processor = new AGCProcessor(defaultConfig);

      const config1 = processor.getConfig();
      const config2 = processor.getConfig();

      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2);
    });

    it("should update config", () => {
      const processor = new AGCProcessor(defaultConfig);

      processor.updateConfig({ targetLevel: 0.5 });

      const config = processor.getConfig();
      expect(config.targetLevel).toBe(0.5);
      expect(config.maxGain).toBe(10.0); // Unchanged
    });

    it("should validate config on update", () => {
      const processor = new AGCProcessor(defaultConfig);

      expect(() => {
        processor.updateConfig({ targetLevel: 1.5 });
      }).toThrow("targetLevel must be between 0 and 1.0");
    });
  });

  describe("state management", () => {
    it("should reset gain to initial value", () => {
      const processor = new AGCProcessor(defaultConfig);
      const samples = generateSamplesWithAmplitude(0.1, 1024);

      // Process to change gain
      for (let i = 0; i < 10; i++) {
        processor.process(samples);
      }

      const gainBefore = processor.getCurrentGain();
      expect(gainBefore).not.toBe(1.0);

      processor.reset();

      const gainAfter = processor.getCurrentGain();
      expect(gainAfter).toBe(1.0);
    });

    it("should return current gain", () => {
      const processor = new AGCProcessor(defaultConfig);

      const initialGain = processor.getCurrentGain();
      expect(initialGain).toBe(1.0);

      const samples = generateSamplesWithAmplitude(0.1, 1024);
      const output = processor.process(samples);

      expect(processor.getCurrentGain()).toBe(output.currentGain);
    });
  });

  describe("attack and decay", () => {
    it("should respond faster with shorter attack time", () => {
      const fastAttack = new AGCProcessor({
        ...defaultConfig,
        attackTime: 0.001,
      });

      const slowAttack = new AGCProcessor({
        ...defaultConfig,
        attackTime: 0.1,
      });

      const weakSignal = generateSamplesWithAmplitude(0.1, 1024);

      // Process once
      const fastOutput = fastAttack.process(weakSignal);
      const slowOutput = slowAttack.process(weakSignal);

      // Fast attack should reach higher gain faster
      expect(fastOutput.currentGain).toBeGreaterThan(slowOutput.currentGain);
    });

    it("should use different decay times", () => {
      const fastDecay = new AGCProcessor({
        ...defaultConfig,
        decayTime: 0.001,
      });

      const slowDecay = new AGCProcessor({
        ...defaultConfig,
        decayTime: 0.1,
      });

      const weakSignal = generateSamplesWithAmplitude(0.1, 1024);

      // Process to verify both work
      const fastOutput = fastDecay.process(weakSignal);
      const slowOutput = slowDecay.process(weakSignal);

      // Both should produce valid output
      expect(fastOutput.samples).toHaveLength(weakSignal.length);
      expect(slowOutput.samples).toHaveLength(weakSignal.length);
      expect(fastOutput.currentGain).toBeGreaterThan(0);
      expect(slowOutput.currentGain).toBeGreaterThan(0);
    });
  });
});
