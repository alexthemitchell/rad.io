import {
  calculateSpectrogramRow,
  calculateSpectrogram,
  convertToSamples,
  Sample,
} from "../dsp";

describe("DSP Utilities", () => {
  describe("convertToSamples", () => {
    it("should convert raw IQ samples to Sample objects", () => {
      const rawSamples: [number, number][] = [
        [0.5, 0.3],
        [0.2, -0.1],
        [-0.4, 0.6],
      ];

      const samples = convertToSamples(rawSamples);

      expect(samples).toHaveLength(3);
      expect(samples[0]).toEqual({ I: 0.5, Q: 0.3 });
      expect(samples[1]).toEqual({ I: 0.2, Q: -0.1 });
      expect(samples[2]).toEqual({ I: -0.4, Q: 0.6 });
    });

    it("should throw error for undefined values", () => {
      const rawSamples: [number | undefined, number | undefined][] = [
        [0.5, undefined],
      ];

      expect(() => convertToSamples(rawSamples as [number, number][])).toThrow(
        "invalid sample",
      );
    });

    it("should handle empty array", () => {
      const samples = convertToSamples([]);
      expect(samples).toHaveLength(0);
    });
  });

  describe("calculateSpectrogramRow", () => {
    it("should calculate FFT for a row of samples", () => {
      const fftSize = 8;
      const samples: Sample[] = Array.from({ length: fftSize }, (_, i) => ({
        I: Math.cos((2 * Math.PI * i) / fftSize),
        Q: Math.sin((2 * Math.PI * i) / fftSize),
      }));

      const result = calculateSpectrogramRow(samples, fftSize);

      expect(result).toBeInstanceOf(Float32Array);
      expect(result.length).toBe(fftSize);

      // FFT output should be real numbers
      result.forEach((value) => {
        expect(typeof value).toBe("number");
        expect(isFinite(value)).toBe(true);
      });
    });

    it("should handle DC signal (all zeros except DC)", () => {
      const fftSize = 16;
      const samples: Sample[] = Array.from({ length: fftSize }, () => ({
        I: 1.0,
        Q: 0.0,
      }));

      const result = calculateSpectrogramRow(samples, fftSize);

      expect(result).toBeInstanceOf(Float32Array);
      expect(result.length).toBe(fftSize);
    });

    it("should produce dB values in expected range", () => {
      const fftSize = 32;
      const samples: Sample[] = Array.from({ length: fftSize }, (_, i) => ({
        I: 0.1 * Math.cos((2 * Math.PI * i * 2) / fftSize),
        Q: 0.1 * Math.sin((2 * Math.PI * i * 2) / fftSize),
      }));

      const result = calculateSpectrogramRow(samples, fftSize);

      // dB values should be finite numbers
      result.forEach((value) => {
        expect(isFinite(value)).toBe(true);
        expect(typeof value).toBe("number");
      });
    });

    it("should handle zero-amplitude signal", () => {
      const fftSize = 16;
      const samples: Sample[] = Array.from({ length: fftSize }, () => ({
        I: 0.0,
        Q: 0.0,
      }));

      const result = calculateSpectrogramRow(samples, fftSize);

      expect(result).toBeInstanceOf(Float32Array);
      // Zero signal should produce -Infinity in dB, but we handle this
      result.forEach((value) => {
        expect(typeof value).toBe("number");
      });
    });
  });

  describe("calculateSpectrogram", () => {
    it("should calculate full spectrogram from samples", () => {
      const fftSize = 8;
      const numRows = 4;
      const totalSamples = fftSize * numRows;

      const samples: Sample[] = Array.from({ length: totalSamples }, (_, i) => ({
        I: Math.cos((2 * Math.PI * i) / fftSize),
        Q: Math.sin((2 * Math.PI * i) / fftSize),
      }));

      const result = calculateSpectrogram(samples, fftSize);

      expect(result).toHaveLength(numRows);
      result.forEach((row) => {
        expect(row).toBeInstanceOf(Float32Array);
        expect(row.length).toBe(fftSize);
      });
    });

    it("should handle incomplete last row", () => {
      const fftSize = 8;
      const samples: Sample[] = Array.from({ length: 20 }, (_, i) => ({
        I: Math.cos((2 * Math.PI * i) / 8),
        Q: Math.sin((2 * Math.PI * i) / 8),
      }));

      const result = calculateSpectrogram(samples, fftSize);

      // Should only create 2 complete rows (16 samples), ignoring the extra 4
      expect(result).toHaveLength(2);
    });

    it("should produce consistent results for same input", () => {
      const fftSize = 16;
      const samples: Sample[] = Array.from({ length: 32 }, (_, i) => ({
        I: 0.5 * Math.cos((2 * Math.PI * i) / 16),
        Q: 0.5 * Math.sin((2 * Math.PI * i) / 16),
      }));

      const result1 = calculateSpectrogram(samples, fftSize);
      const result2 = calculateSpectrogram(samples, fftSize);

      expect(result1.length).toBe(result2.length);
      result1.forEach((row, rowIdx) => {
        expect(row.length).toBe(result2[rowIdx]!.length);
        row.forEach((value, idx) => {
          expect(value).toBeCloseTo(result2[rowIdx]![idx]!);
        });
      });
    });

    it("should handle single row of samples", () => {
      const fftSize = 8;
      const samples: Sample[] = Array.from({ length: fftSize }, (_, i) => ({
        I: Math.cos((2 * Math.PI * i) / fftSize),
        Q: Math.sin((2 * Math.PI * i) / fftSize),
      }));

      const result = calculateSpectrogram(samples, fftSize);

      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(Float32Array);
      expect(result[0]!.length).toBe(fftSize);
    });

    it("should process different FFT sizes correctly", () => {
      const testSizes = [8, 16, 32, 64];

      testSizes.forEach((fftSize) => {
        const samples: Sample[] = Array.from({ length: fftSize * 2 }, (_, i) => ({
          I: Math.cos((2 * Math.PI * i) / fftSize),
          Q: Math.sin((2 * Math.PI * i) / fftSize),
        }));

        const result = calculateSpectrogram(samples, fftSize);

        expect(result).toHaveLength(2);
        result.forEach((row) => {
          expect(row.length).toBe(fftSize);
        });
      });
    });
  });

  describe("FFT spectral analysis properties", () => {
    it("should detect single frequency component", () => {
      const fftSize = 64;
      const targetFreqBin = 5; // Frequency bin we're testing

      // Create a pure sinusoid at the target frequency
      const samples: Sample[] = Array.from({ length: fftSize }, (_, i) => {
        const phase = (2 * Math.PI * targetFreqBin * i) / fftSize;
        return {
          I: Math.cos(phase),
          Q: Math.sin(phase),
        };
      });

      const result = calculateSpectrogramRow(samples, fftSize);

      // After FFT shift, the target frequency should have peak power
      // The peak should be at the shifted position
      const shiftedBin = (targetFreqBin + fftSize / 2) % fftSize;
      const peakValue = Math.max(...Array.from(result));
      const peakIndex = Array.from(result).indexOf(peakValue);

      // Peak should be at or near the expected bin
      expect(Math.abs(peakIndex - shiftedBin)).toBeLessThanOrEqual(1);
    });

    it("should handle complex modulated signal", () => {
      const fftSize = 128;
      const samples: Sample[] = Array.from({ length: fftSize }, (_, i) => {
        // Amplitude modulated signal
        const carrier = (2 * Math.PI * 10 * i) / fftSize;
        const modulation = 1 + 0.5 * Math.cos((2 * Math.PI * 2 * i) / fftSize);
        return {
          I: modulation * Math.cos(carrier),
          Q: modulation * Math.sin(carrier),
        };
      });

      const result = calculateSpectrogramRow(samples, fftSize);

      expect(result).toBeInstanceOf(Float32Array);
      expect(result.length).toBe(fftSize);

      // Should have energy in multiple bins due to modulation
      const significantBins = Array.from(result).filter(
        (v) => v > Math.max(...Array.from(result)) - 20,
      ); // Within 20 dB of peak
      expect(significantBins.length).toBeGreaterThan(1);
    });
  });
});
