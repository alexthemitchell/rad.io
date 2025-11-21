/**
 * Unit tests for Signal Measurement Conversion Utilities
 * Tests conversion boundary cases, HF vs VHF differences, and calibration handling
 */

import { convertDbfsToDbm, dbmToSUnit } from "../signalMeasurement";

describe("Signal Measurement Conversions", () => {
  describe("convertDbfsToDbm", () => {
    it("should correctly convert dBFS to dBm with positive calibration constant", () => {
      // Typical scenario: dBFS + K_cal = dBm
      expect(convertDbfsToDbm(-30, -70)).toBe(-100);
      expect(convertDbfsToDbm(-20, -60)).toBe(-80);
      expect(convertDbfsToDbm(-10, -50)).toBe(-60);
    });

    it("should correctly apply calibration offset", () => {
      // With calibration offset
      expect(convertDbfsToDbm(-30, -70, 5)).toBe(-95);
      expect(convertDbfsToDbm(-30, -70, -5)).toBe(-105);
      expect(convertDbfsToDbm(-20, -60, 2.5)).toBe(-77.5);
    });

    it("should correctly convert with zero dBFS (maximum ADC input)", () => {
      expect(convertDbfsToDbm(0, -60)).toBe(-60);
      expect(convertDbfsToDbm(0, -80)).toBe(-80);
    });

    it("should handle very weak signals (large negative dBFS)", () => {
      expect(convertDbfsToDbm(-100, -60)).toBe(-160);
      expect(convertDbfsToDbm(-80, -70)).toBe(-150);
    });

    it("should work with different calibration constants", () => {
      const dbfs = -40;

      // HackRF HF typical
      expect(convertDbfsToDbm(dbfs, -60)).toBe(-100);

      // HackRF VHF typical
      expect(convertDbfsToDbm(dbfs, -70)).toBe(-110);

      // RTL-SDR HF with upconverter
      expect(convertDbfsToDbm(dbfs, -50)).toBe(-90);

      // RTL-SDR VHF
      expect(convertDbfsToDbm(dbfs, -65)).toBe(-105);
    });

    it("should maintain precision with fractional values", () => {
      expect(convertDbfsToDbm(-30.5, -70.3)).toBeCloseTo(-100.8, 1);
      expect(convertDbfsToDbm(-15.7, -55.2)).toBeCloseTo(-70.9, 1);
    });
  });

  describe("dbmToSUnit - HF Band", () => {
    it("should return S9 for the reference level (-73 dBm)", () => {
      const result = dbmToSUnit(-73, "HF");
      expect(result.sUnit).toBe(9);
      expect(result.overS9).toBe(0);
    });

    it("should correctly calculate S-units below S9", () => {
      // S8 = -79 dBm (6 dB below S9)
      expect(dbmToSUnit(-79, "HF")).toEqual({ sUnit: 8, overS9: 0 });

      // S7 = -85 dBm (12 dB below S9)
      expect(dbmToSUnit(-85, "HF")).toEqual({ sUnit: 7, overS9: 0 });

      // S6 = -91 dBm
      expect(dbmToSUnit(-91, "HF")).toEqual({ sUnit: 6, overS9: 0 });

      // S5 = -97 dBm
      expect(dbmToSUnit(-97, "HF")).toEqual({ sUnit: 5, overS9: 0 });

      // S4 = -103 dBm
      expect(dbmToSUnit(-103, "HF")).toEqual({ sUnit: 4, overS9: 0 });

      // S3 = -109 dBm
      expect(dbmToSUnit(-109, "HF")).toEqual({ sUnit: 3, overS9: 0 });

      // S2 = -115 dBm
      expect(dbmToSUnit(-115, "HF")).toEqual({ sUnit: 2, overS9: 0 });

      // S1 = -121 dBm
      expect(dbmToSUnit(-121, "HF")).toEqual({ sUnit: 1, overS9: 0 });

      // S0 = -127 dBm or below
      expect(dbmToSUnit(-127, "HF")).toEqual({ sUnit: 0, overS9: 0 });
    });

    it("should calculate overS9 for signals above S9", () => {
      // S9+10
      expect(dbmToSUnit(-63, "HF")).toEqual({ sUnit: 9, overS9: 10 });

      // S9+20
      expect(dbmToSUnit(-53, "HF")).toEqual({ sUnit: 9, overS9: 20 });

      // S9+40
      expect(dbmToSUnit(-33, "HF")).toEqual({ sUnit: 9, overS9: 40 });

      // S9+60
      expect(dbmToSUnit(-13, "HF")).toEqual({ sUnit: 9, overS9: 60 });
    });

    it("should handle very strong signals", () => {
      expect(dbmToSUnit(0, "HF")).toEqual({ sUnit: 9, overS9: 73 });
      expect(dbmToSUnit(10, "HF")).toEqual({ sUnit: 9, overS9: 83 });
    });

    it("should handle extremely weak signals", () => {
      expect(dbmToSUnit(-140, "HF")).toEqual({ sUnit: 0, overS9: 0 });
      expect(dbmToSUnit(-150, "HF")).toEqual({ sUnit: 0, overS9: 0 });
    });

    it("should round to nearest S-unit for intermediate values", () => {
      // Halfway between S8 (-79) and S7 (-85) = -82 dBm
      // 3 dB below S8, rounds down to S7 or S8 depending on rounding
      const result = dbmToSUnit(-82, "HF");
      expect(result.sUnit).toBeGreaterThanOrEqual(7);
      expect(result.sUnit).toBeLessThanOrEqual(8);
      expect(result.overS9).toBe(0);
    });
  });

  describe("dbmToSUnit - VHF/UHF Band", () => {
    it("should return S9 for the VHF reference level (-93 dBm)", () => {
      const result = dbmToSUnit(-93, "VHF");
      expect(result.sUnit).toBe(9);
      expect(result.overS9).toBe(0);
    });

    it("should correctly calculate S-units below S9 for VHF", () => {
      // S8 = -99 dBm (6 dB below S9)
      expect(dbmToSUnit(-99, "VHF")).toEqual({ sUnit: 8, overS9: 0 });

      // S7 = -105 dBm
      expect(dbmToSUnit(-105, "VHF")).toEqual({ sUnit: 7, overS9: 0 });

      // S6 = -111 dBm
      expect(dbmToSUnit(-111, "VHF")).toEqual({ sUnit: 6, overS9: 0 });

      // S5 = -117 dBm
      expect(dbmToSUnit(-117, "VHF")).toEqual({ sUnit: 5, overS9: 0 });

      // S4 = -123 dBm
      expect(dbmToSUnit(-123, "VHF")).toEqual({ sUnit: 4, overS9: 0 });

      // S3 = -129 dBm
      expect(dbmToSUnit(-129, "VHF")).toEqual({ sUnit: 3, overS9: 0 });

      // S2 = -135 dBm
      expect(dbmToSUnit(-135, "VHF")).toEqual({ sUnit: 2, overS9: 0 });

      // S1 = -141 dBm
      expect(dbmToSUnit(-141, "VHF")).toEqual({ sUnit: 1, overS9: 0 });

      // S0 = -147 dBm or below
      expect(dbmToSUnit(-147, "VHF")).toEqual({ sUnit: 0, overS9: 0 });
    });

    it("should calculate overS9 for VHF signals above S9", () => {
      // S9+10
      expect(dbmToSUnit(-83, "VHF")).toEqual({ sUnit: 9, overS9: 10 });

      // S9+20
      expect(dbmToSUnit(-73, "VHF")).toEqual({ sUnit: 9, overS9: 20 });

      // S9+40
      expect(dbmToSUnit(-53, "VHF")).toEqual({ sUnit: 9, overS9: 40 });

      // S9+60
      expect(dbmToSUnit(-33, "VHF")).toEqual({ sUnit: 9, overS9: 60 });
    });

    it("should show 20 dB difference between HF and VHF S9 levels", () => {
      // Same dBm value should give different S-units for HF vs VHF
      const dbm = -83;

      const hfResult = dbmToSUnit(dbm, "HF");
      const vhfResult = dbmToSUnit(dbm, "VHF");

      // -83 dBm is S7 for HF (-85 ±3 dB)
      expect(hfResult.sUnit).toBeGreaterThanOrEqual(7);
      expect(hfResult.sUnit).toBeLessThanOrEqual(8);

      // -83 dBm is S9+10 for VHF
      expect(vhfResult.sUnit).toBe(9);
      expect(vhfResult.overS9).toBe(10);
    });
  });

  describe("Combined Conversion Workflow", () => {
    it("should convert dBFS -> dBm -> S-unit for HF", () => {
      const dbfs = -30;
      const kCal = -43; // Results in -73 dBm (S9 for HF)

      const dbm = convertDbfsToDbm(dbfs, kCal);
      expect(dbm).toBe(-73);

      const sUnit = dbmToSUnit(dbm, "HF");
      expect(sUnit).toEqual({ sUnit: 9, overS9: 0 });
    });

    it("should convert dBFS -> dBm -> S-unit for VHF", () => {
      const dbfs = -23;
      const kCal = -70; // Results in -93 dBm (S9 for VHF)

      const dbm = convertDbfsToDbm(dbfs, kCal);
      expect(dbm).toBe(-93);

      const sUnit = dbmToSUnit(dbm, "VHF");
      expect(sUnit).toEqual({ sUnit: 9, overS9: 0 });
    });

    it("should handle weak signal complete workflow", () => {
      const dbfs = -80; // Very weak signal in dBFS
      const kCal = -40; // Typical calibration

      const dbm = convertDbfsToDbm(dbfs, kCal);
      expect(dbm).toBe(-120);

      // Check both bands
      const hfResult = dbmToSUnit(dbm, "HF");
      expect(hfResult.sUnit).toBe(1); // S1 for HF

      const vhfResult = dbmToSUnit(dbm, "VHF");
      expect(vhfResult.sUnit).toBe(4); // S4 for VHF (stronger reading due to different S9 ref)
    });

    it("should handle strong signal complete workflow", () => {
      const dbfs = -5; // Strong signal near clipping
      const kCal = -60;

      const dbm = convertDbfsToDbm(dbfs, kCal);
      expect(dbm).toBe(-65);

      const hfResult = dbmToSUnit(dbm, "HF");
      expect(hfResult.sUnit).toBe(9);
      expect(hfResult.overS9).toBe(8); // S9+8

      const vhfResult = dbmToSUnit(dbm, "VHF");
      expect(vhfResult.sUnit).toBe(9);
      expect(vhfResult.overS9).toBe(28); // S9+28
    });
  });

  describe("Boundary Conditions", () => {
    it("should handle exactly S-unit thresholds", () => {
      // HF S-unit exact thresholds
      const hfThresholds = [
        { dbm: -73, expected: 9 }, // S9
        { dbm: -79, expected: 8 }, // S8
        { dbm: -85, expected: 7 }, // S7
        { dbm: -91, expected: 6 }, // S6
      ];

      hfThresholds.forEach(({ dbm, expected }) => {
        const result = dbmToSUnit(dbm, "HF");
        expect(result.sUnit).toBe(expected);
        expect(result.overS9).toBe(0);
      });
    });

    it("should handle fractional dBm values", () => {
      const result = dbmToSUnit(-72.5, "HF");
      expect(result.sUnit).toBe(9);
      expect(result.overS9).toBeCloseTo(0.5, 1);
    });

    it("should never return negative S-units", () => {
      // Extremely weak signals should floor at S0
      const extremelyWeak = [-200, -180, -160, -150];

      extremelyWeak.forEach((dbm) => {
        const hfResult = dbmToSUnit(dbm, "HF");
        const vhfResult = dbmToSUnit(dbm, "VHF");

        expect(hfResult.sUnit).toBeGreaterThanOrEqual(0);
        expect(vhfResult.sUnit).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe("Extreme Signal Saturation", () => {
    it("should handle ADC saturation levels (0 dBFS)", () => {
      // 0 dBFS = maximum ADC input (clipping)
      const dbfs = 0;
      const kCal = -70;
      const calibrationOffset = 0;

      const dbm = convertDbfsToDbm(dbfs, kCal, calibrationOffset);
      expect(dbm).toBe(-70);

      // For HF: -70 dBm = S9 + 3 dB
      const hfResult = dbmToSUnit(dbm, "HF");
      expect(hfResult.sUnit).toBe(9);
      expect(hfResult.overS9).toBe(3);

      // For VHF: -70 dBm = S9 + 23 dB
      const vhfResult = dbmToSUnit(dbm, "VHF");
      expect(vhfResult.sUnit).toBe(9);
      expect(vhfResult.overS9).toBe(23);
    });

    it("should handle extremely strong signals beyond typical range", () => {
      // Test signals that would clip most SDRs (+10 dBm at antenna)
      const extremeSignals = [
        { dbfs: 0, kCal: -20, expectedDbm: -20 }, // Very strong
        { dbfs: 0, kCal: -10, expectedDbm: -10 }, // Extremely strong
        { dbfs: 0, kCal: 0, expectedDbm: 0 }, // Maximum test case
        { dbfs: 0, kCal: 10, expectedDbm: 10 }, // Beyond reasonable (1W at antenna!)
      ];

      extremeSignals.forEach(({ dbfs, kCal, expectedDbm }) => {
        const dbm = convertDbfsToDbm(dbfs, kCal);
        expect(dbm).toBe(expectedDbm);

        // HF: S9 is -73 dBm, so these are all very strong
        const hfResult = dbmToSUnit(dbm, "HF");
        expect(hfResult.sUnit).toBe(9);
        expect(hfResult.overS9).toBe(dbm + 73); // Over S9 in dB (S9 = -73 dBm)

        // VHF: S9 is -93 dBm
        const vhfResult = dbmToSUnit(dbm, "VHF");
        expect(vhfResult.sUnit).toBe(9);
        expect(vhfResult.overS9).toBe(dbm + 93); // Over S9 in dB (S9 = -93 dBm)
      });
    });

    it("should handle near-clipping scenarios with maximum gain", () => {
      // Scenario: SDR with maximum gain settings, strong local signal
      // dBFS near 0 (clipping), high calibration constant
      const scenarios = [
        { dbfs: -1, kCal: -30 }, // 1dB below clipping, high gain
        { dbfs: -0.5, kCal: -25 }, // 0.5dB below clipping
        { dbfs: -0.1, kCal: -20 }, // Just barely avoiding clipping
      ];

      scenarios.forEach(({ dbfs, kCal }) => {
        const dbm = convertDbfsToDbm(dbfs, kCal);

        // Should produce valid S-meter readings even at extreme levels
        const hfResult = dbmToSUnit(dbm, "HF");
        expect(hfResult.sUnit).toBe(9);
        expect(hfResult.overS9).toBeGreaterThan(0);
        expect(Number.isFinite(hfResult.overS9)).toBe(true);

        const vhfResult = dbmToSUnit(dbm, "VHF");
        expect(vhfResult.sUnit).toBe(9);
        expect(vhfResult.overS9).toBeGreaterThan(0);
        expect(Number.isFinite(vhfResult.overS9)).toBe(true);
      });
    });

    it("should handle maximum user calibration offset with saturation", () => {
      // User applies maximum +50 dB calibration offset
      // Combined with 0 dBFS and high kCal
      const dbfs = 0;
      const kCal = -30;
      const maxCalibrationOffset = 50;

      const dbm = convertDbfsToDbm(dbfs, kCal, maxCalibrationOffset);
      expect(dbm).toBe(20); // 0 + (-30) + 50 = 20 dBm

      // This is an extremely strong signal (10 milliwatts at antenna!)
      const hfResult = dbmToSUnit(dbm, "HF");
      expect(hfResult.sUnit).toBe(9);
      expect(hfResult.overS9).toBe(93); // 20 - (-73) = 93 dB over S9

      const vhfResult = dbmToSUnit(dbm, "VHF");
      expect(vhfResult.sUnit).toBe(9);
      expect(vhfResult.overS9).toBe(113); // 20 - (-93) = 113 dB over S9
    });

    it("should handle minimum user calibration offset with saturation", () => {
      // User applies minimum -50 dB calibration offset
      const dbfs = 0;
      const kCal = -30;
      const minCalibrationOffset = -50;

      const dbm = convertDbfsToDbm(dbfs, kCal, minCalibrationOffset);
      expect(dbm).toBe(-80); // 0 + (-30) + (-50) = -80 dBm

      // For HF: -80 dBm = S8 range
      const hfResult = dbmToSUnit(dbm, "HF");
      expect(hfResult.sUnit).toBeLessThanOrEqual(9);
      expect(hfResult.sUnit).toBeGreaterThanOrEqual(7);

      // For VHF: -80 dBm = S9+13
      const vhfResult = dbmToSUnit(dbm, "VHF");
      expect(vhfResult.sUnit).toBe(9);
      expect(vhfResult.overS9).toBe(13);
    });

    it("should maintain precision with extreme combined values", () => {
      // Test that calculations don't lose precision or overflow
      const extremeCombinations = [
        { dbfs: 0, kCal: 50, offset: 50 }, // All maximum positive
        { dbfs: -150, kCal: -100, offset: -50 }, // All maximum negative
        { dbfs: 0, kCal: -100, offset: 50 }, // Opposing extremes
        { dbfs: -100, kCal: 50, offset: -50 }, // Opposing extremes reversed
      ];

      extremeCombinations.forEach(({ dbfs, kCal, offset }) => {
        const dbm = convertDbfsToDbm(dbfs, kCal, offset);
        const expected = dbfs + kCal + offset;

        expect(dbm).toBe(expected);
        expect(Number.isFinite(dbm)).toBe(true);
        expect(Number.isNaN(dbm)).toBe(false);

        // Should produce valid S-meter readings
        const hfResult = dbmToSUnit(dbm, "HF");
        expect(Number.isFinite(hfResult.sUnit)).toBe(true);
        expect(Number.isFinite(hfResult.overS9)).toBe(true);
        expect(hfResult.sUnit).toBeGreaterThanOrEqual(0);

        const vhfResult = dbmToSUnit(dbm, "VHF");
        expect(Number.isFinite(vhfResult.sUnit)).toBe(true);
        expect(Number.isFinite(vhfResult.overS9)).toBe(true);
        expect(vhfResult.sUnit).toBeGreaterThanOrEqual(0);
      });
    });

    it("should handle realistic saturation with typical SDR values", () => {
      // HackRF One with max gain, strong local FM station
      // Typical scenario: 100 MHz FM station, 1 mile away, 50 kW transmitter
      // Expected field strength: ~-20 dBm at antenna
      const dbfs = -3; // Slight headroom to avoid clipping
      const kCal = -17; // High gain setting
      const calibrationOffset = 0;

      const dbm = convertDbfsToDbm(dbfs, kCal, calibrationOffset);
      expect(dbm).toBe(-20);

      // VHF band (100 MHz)
      const vhfResult = dbmToSUnit(dbm, "VHF");
      expect(vhfResult.sUnit).toBe(9);
      expect(vhfResult.overS9).toBe(73); // Very strong signal

      // This is S9+73, which is extremely strong but physically realistic
      // for a nearby powerful transmitter
    });

    it("should never produce infinite or NaN values for any input", () => {
      // Stress test with a wide range of values
      const testValues = {
        dbfs: [0, -1, -10, -50, -100, -150, -200],
        kCal: [50, 10, 0, -10, -50, -100],
        offset: [50, 10, 0, -10, -50],
      };

      testValues.dbfs.forEach((dbfs) => {
        testValues.kCal.forEach((kCal) => {
          testValues.offset.forEach((offset) => {
            const dbm = convertDbfsToDbm(dbfs, kCal, offset);

            expect(Number.isFinite(dbm)).toBe(true);
            expect(Number.isNaN(dbm)).toBe(false);

            const hfResult = dbmToSUnit(dbm, "HF");
            expect(Number.isFinite(hfResult.sUnit)).toBe(true);
            expect(Number.isFinite(hfResult.overS9)).toBe(true);
            expect(Number.isNaN(hfResult.sUnit)).toBe(false);
            expect(Number.isNaN(hfResult.overS9)).toBe(false);
          });
        });
      });
    });
  });
});
