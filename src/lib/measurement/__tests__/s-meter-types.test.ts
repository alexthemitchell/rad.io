/**
 * Tests for S-Meter types and specifications
 * See docs/reference/s-meter-spec.md for full specification
 */

import {
  type SignalLevel,
  type SMeterBand,
  type SMeterCalibration,
  type SMeterConfig,
} from "../types";

describe("S-Meter Types", () => {
  describe("SignalLevel interface", () => {
    it("should accept a valid HF signal level", () => {
      const signalLevel: SignalLevel = {
        dBfs: -42.5,
        dBmApprox: -112.5,
        sUnit: 3,
        overS9: 0,
        band: "HF",
        calibrationStatus: "uncalibrated",
        uncertaintyDb: 10,
        timestamp: Date.now(),
      };

      expect(signalLevel.dBfs).toBe(-42.5);
      expect(signalLevel.dBmApprox).toBe(-112.5);
      expect(signalLevel.sUnit).toBe(3);
      expect(signalLevel.overS9).toBe(0);
      expect(signalLevel.band).toBe("HF");
      expect(signalLevel.calibrationStatus).toBe("uncalibrated");
    });

    it("should accept a valid VHF signal level above S9", () => {
      const signalLevel: SignalLevel = {
        dBfs: -15.0,
        dBmApprox: -80.2,
        sUnit: 9,
        overS9: 12.8,
        band: "VHF",
        calibrationStatus: "user",
        uncertaintyDb: 1.5,
        timestamp: Date.now(),
      };

      expect(signalLevel.sUnit).toBe(9);
      expect(signalLevel.overS9).toBeGreaterThan(0);
      expect(signalLevel.band).toBe("VHF");
      expect(signalLevel.calibrationStatus).toBe("user");
    });

    it("should accept optional uncertaintyDb", () => {
      const signalLevel: SignalLevel = {
        dBfs: -30,
        dBmApprox: -100,
        sUnit: 5,
        overS9: 0,
        band: "HF",
        calibrationStatus: "factory",
        timestamp: Date.now(),
      };

      expect(signalLevel.uncertaintyDb).toBeUndefined();
    });
  });

  describe("SMeterBand type", () => {
    it("should accept HF band", () => {
      const band: SMeterBand = "HF";
      expect(band).toBe("HF");
    });

    it("should accept VHF band", () => {
      const band: SMeterBand = "VHF";
      expect(band).toBe("VHF");
    });
  });

  describe("SMeterCalibration interface", () => {
    it("should accept a valid calibration with all fields", () => {
      const calibration: SMeterCalibration = {
        kCal: -65.2,
        frequencyRange: { min: 88e6, max: 108e6 },
        gainSetting: { lna: 16, vga: 20, rxAmp: true },
        method: "signal-generator",
        accuracyDb: 1.5,
        calibratedAt: Date.now(),
      };

      expect(calibration.kCal).toBe(-65.2);
      expect(calibration.method).toBe("signal-generator");
      expect(calibration.gainSetting?.lna).toBe(16);
      expect(calibration.gainSetting?.vga).toBe(20);
      expect(calibration.gainSetting?.rxAmp).toBe(true);
    });

    it("should accept calibration without optional fields", () => {
      const calibration: SMeterCalibration = {
        kCal: -70,
        frequencyRange: { min: 0, max: 6e9 },
        method: "default",
        accuracyDb: 10,
      };

      expect(calibration.gainSetting).toBeUndefined();
      expect(calibration.calibratedAt).toBeUndefined();
    });

    it("should accept all calibration methods", () => {
      const methods: Array<SMeterCalibration["method"]> = [
        "signal-generator",
        "reference-station",
        "thermal-noise",
        "default",
      ];

      methods.forEach((method) => {
        const calibration: SMeterCalibration = {
          kCal: -60,
          frequencyRange: { min: 0, max: 6e9 },
          method,
          accuracyDb: 5,
        };
        expect(calibration.method).toBe(method);
      });
    });
  });

  describe("SMeterConfig interface", () => {
    it("should accept a complete configuration", () => {
      const config: SMeterConfig = {
        calibration: {
          kCal: -65,
          frequencyRange: { min: 88e6, max: 108e6 },
          method: "signal-generator",
          accuracyDb: 2,
        },
        display: {
          style: "bar",
          showDbm: true,
          showDbfs: false,
          updateRateMs: 100,
          smoothing: 0.2,
        },
      };

      expect(config.display.style).toBe("bar");
      expect(config.display.showDbm).toBe(true);
      expect(config.display.smoothing).toBe(0.2);
    });

    it("should accept all display styles", () => {
      const styles: Array<SMeterConfig["display"]["style"]> = [
        "numeric",
        "bar",
        "needle",
      ];

      styles.forEach((style) => {
        const config: SMeterConfig = {
          calibration: {
            kCal: -60,
            frequencyRange: { min: 0, max: 6e9 },
            method: "default",
            accuracyDb: 10,
          },
          display: {
            style,
            showDbm: false,
            showDbfs: false,
            updateRateMs: 100,
            smoothing: 0.1,
          },
        };
        expect(config.display.style).toBe(style);
      });
    });
  });

  describe("S-Meter Conversion Logic (Specification Examples)", () => {
    describe("HF Band (S9 = -73 dBm)", () => {
      const S9_HF = -73;
      const S_UNIT_WIDTH = 6;

      it("should correctly identify S9 signal", () => {
        const dBm = -73;
        const sUnit = 9;
        const overS9 = 0;

        expect(dBm).toBe(S9_HF);
        expect(sUnit).toBe(9);
        expect(overS9).toBe(0);
      });

      it("should correctly identify S1 signal", () => {
        const dBm = -121; // S9 - (8 * 6dB)
        const expectedSUnit = 1;

        const calculatedSUnit = Math.max(
          0,
          Math.round(9 + (dBm - S9_HF) / S_UNIT_WIDTH),
        );

        expect(calculatedSUnit).toBe(expectedSUnit);
      });

      it("should correctly identify S9+20 signal", () => {
        const dBm = -53; // S9 + 20dB
        const expectedOverS9 = 20;

        if (dBm >= S9_HF) {
          const overS9 = dBm - S9_HF;
          expect(overS9).toBe(expectedOverS9);
        }
      });

      it("should handle S5 signal correctly", () => {
        const dBm = -97; // S9 - (4 * 6dB)
        const expectedSUnit = 5;

        const calculatedSUnit = Math.max(
          0,
          Math.round(9 + (dBm - S9_HF) / S_UNIT_WIDTH),
        );

        expect(calculatedSUnit).toBe(expectedSUnit);
      });
    });

    describe("VHF Band (S9 = -93 dBm)", () => {
      const S9_VHF = -93;
      const S_UNIT_WIDTH = 6;

      it("should correctly identify S9 signal", () => {
        const dBm = -93;
        const sUnit = 9;
        const overS9 = 0;

        expect(dBm).toBe(S9_VHF);
        expect(sUnit).toBe(9);
        expect(overS9).toBe(0);
      });

      it("should correctly identify S1 signal", () => {
        const dBm = -141; // S9 - (8 * 6dB)
        const expectedSUnit = 1;

        const calculatedSUnit = Math.max(
          0,
          Math.round(9 + (dBm - S9_VHF) / S_UNIT_WIDTH),
        );

        expect(calculatedSUnit).toBe(expectedSUnit);
      });

      it("should correctly identify S9+40 signal", () => {
        const dBm = -53; // S9 + 40dB
        const expectedOverS9 = 40;

        if (dBm >= S9_VHF) {
          const overS9 = dBm - S9_VHF;
          expect(overS9).toBe(expectedOverS9);
        }
      });

      it("should clamp S-unit to 0 for very weak signals", () => {
        const dBm = -200; // Well below S1

        const calculatedSUnit = Math.max(
          0,
          Math.round(9 + (dBm - S9_VHF) / S_UNIT_WIDTH),
        );

        expect(calculatedSUnit).toBe(0);
      });
    });

    describe("dBFS to dBm conversion", () => {
      it("should apply calibration constant correctly", () => {
        const dBfs = -42.5;
        const kCal = -70;
        const expectedDbm = -112.5;

        const dBm = dBfs + kCal;

        expect(dBm).toBe(expectedDbm);
      });

      it("should handle different calibration constants", () => {
        const dBfs = -30;

        // HackRF HF
        const kCalHF = -60;
        const dBmHF = dBfs + kCalHF;
        expect(dBmHF).toBe(-90);

        // RTL-SDR VHF
        const kCalVHF = -65;
        const dBmVHF = dBfs + kCalVHF;
        expect(dBmVHF).toBe(-95);
      });
    });

    describe("Band selection based on frequency", () => {
      it("should select HF for frequencies below 30 MHz", () => {
        const frequencies = [1.8e6, 7e6, 14e6, 21e6, 28e6];

        frequencies.forEach((freq) => {
          const band: SMeterBand = freq < 30e6 ? "HF" : "VHF";
          expect(band).toBe("HF");
        });
      });

      it("should select VHF for frequencies at or above 30 MHz", () => {
        const frequencies = [50e6, 144e6, 440e6, 1296e6];

        frequencies.forEach((freq) => {
          const band: SMeterBand = freq >= 30e6 ? "VHF" : "HF";
          expect(band).toBe("VHF");
        });
      });

      it("should handle boundary at exactly 30 MHz", () => {
        const BAND_BOUNDARY_HZ = 30e6;

        // Helper function to classify band (matches spec logic)
        const classifyBand = (frequencyHz: number): SMeterBand => {
          return frequencyHz >= BAND_BOUNDARY_HZ ? "VHF" : "HF";
        };

        // Test exactly at boundary - should be VHF
        expect(classifyBand(30e6)).toBe("VHF");

        // Test just below boundary - should be HF
        expect(classifyBand(29.999999e6)).toBe("HF");

        // Test just above boundary - should be VHF
        expect(classifyBand(30.000001e6)).toBe("VHF");
      });
    });
  });

  describe("Calibration Status", () => {
    it("should track uncalibrated measurements", () => {
      const signal: SignalLevel = {
        dBfs: -40,
        dBmApprox: -110,
        sUnit: 4,
        overS9: 0,
        band: "HF",
        calibrationStatus: "uncalibrated",
        uncertaintyDb: 10,
        timestamp: Date.now(),
      };

      expect(signal.calibrationStatus).toBe("uncalibrated");
      expect(signal.uncertaintyDb).toBe(10);
    });

    it("should track factory calibrated measurements", () => {
      const signal: SignalLevel = {
        dBfs: -40,
        dBmApprox: -105,
        sUnit: 5,
        overS9: 0,
        band: "VHF",
        calibrationStatus: "factory",
        uncertaintyDb: 3,
        timestamp: Date.now(),
      };

      expect(signal.calibrationStatus).toBe("factory");
      expect(signal.uncertaintyDb).toBe(3);
    });

    it("should track user calibrated measurements", () => {
      const signal: SignalLevel = {
        dBfs: -35,
        dBmApprox: -100.2,
        sUnit: 5,
        overS9: 0,
        band: "VHF",
        calibrationStatus: "user",
        uncertaintyDb: 1.5,
        timestamp: Date.now(),
      };

      expect(signal.calibrationStatus).toBe("user");
      expect(signal.uncertaintyDb).toBe(1.5);
    });
  });
});
