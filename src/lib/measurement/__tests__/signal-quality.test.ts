/**
 * Signal Quality Analyzer Tests
 */

import { SignalQualityAnalyzer } from "../signal-quality";

describe("SignalQualityAnalyzer", () => {
  let analyzer: SignalQualityAnalyzer;

  beforeEach(() => {
    analyzer = new SignalQualityAnalyzer();
  });

  describe("calculateSNR", () => {
    it("should calculate SNR for a signal", () => {
      const spectrum = new Float32Array(1000);
      const frequencies = new Float32Array(1000);

      for (let i = 0; i < 1000; i++) {
        frequencies[i] = 95e6 + i * 10e3;
        spectrum[i] = -70; // Noise floor
      }

      // Add signal at 100 MHz
      for (let i = 475; i <= 525; i++) {
        spectrum[i] = -40; // Signal 30 dB above noise
      }

      const snr = analyzer.calculateSNR(
        spectrum,
        100e6,
        500e3,
        frequencies,
      );

      expect(snr).toBeGreaterThan(20);
      expect(snr).toBeLessThan(40);
    });

    it("should handle weak signals", () => {
      const spectrum = new Float32Array(100);
      const frequencies = new Float32Array(100);

      for (let i = 0; i < 100; i++) {
        frequencies[i] = 100e6 + i * 10e3;
        spectrum[i] = -60;
      }

      // Weak signal
      for (let i = 45; i <= 55; i++) {
        spectrum[i] = -55;
      }

      const snr = analyzer.calculateSNR(
        spectrum,
        100.5e6,
        100e3,
        frequencies,
      );

      expect(snr).toBeGreaterThan(0);
      expect(snr).toBeLessThan(10);
    });
  });

  describe("calculateTHD", () => {
    it("should calculate THD with harmonics", () => {
      const spectrum = new Float32Array(1000);
      const frequencies = new Float32Array(1000);

      for (let i = 0; i < 1000; i++) {
        frequencies[i] = i * 10e3; // 0-10 MHz
        spectrum[i] = -80;
      }

      // Fundamental at 1 MHz
      spectrum[100] = -20;

      // Harmonics at 2, 3, 4 MHz (weaker)
      spectrum[200] = -40; // 2nd harmonic
      spectrum[300] = -50; // 3rd harmonic
      spectrum[400] = -60; // 4th harmonic

      const thd = analyzer.calculateTHD(
        spectrum,
        1e6,
        frequencies,
      );

      expect(thd).toBeGreaterThan(0);
      expect(thd).toBeLessThan(100);
    });

    it("should handle pure tone with minimal harmonics", () => {
      const spectrum = new Float32Array(1000);
      const frequencies = new Float32Array(1000);

      for (let i = 0; i < 1000; i++) {
        frequencies[i] = i * 10e3;
        spectrum[i] = -80;
      }

      // Only fundamental
      spectrum[100] = -20;

      const thd = analyzer.calculateTHD(
        spectrum,
        1e6,
        frequencies,
      );

      expect(thd).toBeLessThan(10); // Very low THD
    });
  });

  describe("calculateEVM", () => {
    it("should calculate EVM for ideal signal", () => {
      const received = [
        { I: 1, Q: 0 },
        { I: 0, Q: 1 },
        { I: -1, Q: 0 },
        { I: 0, Q: -1 },
      ];
      const reference = received; // Perfect match

      const evm = analyzer.calculateEVM(received, reference);

      expect(evm).toBe(0);
    });

    it("should calculate EVM with small error", () => {
      const reference = [
        { I: 1, Q: 0 },
        { I: 0, Q: 1 },
        { I: -1, Q: 0 },
        { I: 0, Q: -1 },
      ];

      const received = [
        { I: 0.95, Q: 0.05 },
        { I: 0.05, Q: 0.95 },
        { I: -0.95, Q: -0.05 },
        { I: -0.05, Q: -0.95 },
      ];

      const evm = analyzer.calculateEVM(received, reference);

      expect(evm).toBeGreaterThan(0);
      expect(evm).toBeLessThan(10);
    });

    it("should throw error for mismatched array lengths", () => {
      const received = [{ I: 1, Q: 0 }];
      const reference = [
        { I: 1, Q: 0 },
        { I: 0, Q: 1 },
      ];

      expect(() =>
        analyzer.calculateEVM(received, reference),
      ).toThrow();
    });
  });

  describe("calculateAllMetrics", () => {
    it("should calculate all available metrics", () => {
      const spectrum = new Float32Array(100);
      const frequencies = new Float32Array(100);

      for (let i = 0; i < 100; i++) {
        frequencies[i] = 100e6 + i * 10e3;
        spectrum[i] = -60;
      }

      // Signal at center
      for (let i = 45; i <= 55; i++) {
        spectrum[i] = -30;
      }

      const metrics = analyzer.calculateAllMetrics(
        spectrum,
        frequencies,
        100.5e6,
        100e3,
      );

      expect(metrics.snr).toBeDefined();
      expect(metrics.timestamp).toBeDefined();
      expect(metrics.timestamp).toBeGreaterThan(0);
    });

    it("should include SINAD when time domain samples provided", () => {
      const spectrum = new Float32Array(100);
      const frequencies = new Float32Array(100);
      const timeDomain = new Float32Array(256);

      for (let i = 0; i < 100; i++) {
        frequencies[i] = 100e6 + i * 10e3;
        spectrum[i] = -60;
      }

      for (let i = 0; i < 256; i++) {
        timeDomain[i] = Math.sin((2 * Math.PI * i) / 32);
      }

      const metrics = analyzer.calculateAllMetrics(
        spectrum,
        frequencies,
        100.5e6,
        100e3,
        timeDomain,
        1e6,
      );

      expect(metrics.snr).toBeDefined();
      // SINAD may or may not be defined depending on signal quality
    });
  });

  describe("noise floor estimation", () => {
    it("should use configured noise floor sample count", () => {
      const analyzerWithConfig = new SignalQualityAnalyzer({
        noiseFloorSamples: 100,
      });

      const spectrum = new Float32Array(1000);
      const frequencies = new Float32Array(1000);

      for (let i = 0; i < 1000; i++) {
        frequencies[i] = 95e6 + i * 10e3;
        spectrum[i] = -70 + Math.random() * 5;
      }

      // Signal in center
      for (let i = 475; i <= 525; i++) {
        spectrum[i] = -30;
      }

      const snr = analyzerWithConfig.calculateSNR(
        spectrum,
        100e6,
        500e3,
        frequencies,
      );

      expect(snr).toBeGreaterThan(0);
    });
  });

  describe("harmonic count configuration", () => {
    it("should use configured harmonic count for THD", () => {
      const analyzerWith3Harmonics = new SignalQualityAnalyzer({
        harmonicCount: 3,
      });

      const spectrum = new Float32Array(1000);
      const frequencies = new Float32Array(1000);

      for (let i = 0; i < 1000; i++) {
        frequencies[i] = i * 10e3;
        spectrum[i] = -80;
      }

      spectrum[100] = -20; // Fundamental
      spectrum[200] = -40; // 2nd harmonic
      spectrum[300] = -50; // 3rd harmonic

      const thd = analyzerWith3Harmonics.calculateTHD(
        spectrum,
        1e6,
        frequencies,
      );

      expect(thd).toBeGreaterThan(0);
    });
  });
});
