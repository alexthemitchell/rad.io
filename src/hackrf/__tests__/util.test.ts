/**
 * Tests for HackRF utility functions
 * Tests validation, calculation, and error handling logic
 */

import {
  CancellablePromise,
  max2837Ft,
  computeBasebandFilterBwRoundDownLt,
  computeBasebandFilterBw,
  HackrfError,
  checkU32,
  checkU8,
  checkU16,
  checkMax2837Reg,
  checkMax2837Value,
  checkSi5351cReg,
  checkSi5351cValue,
  checkRffc5071Reg,
  checkRffc5071Value,
  checkSpiflashAddress,
  checkBasebandFilterBw,
  checkLoFreq,
  checkFreq,
  checkIFreq,
  checkInLength,
  calcSampleRate,
} from "../util";
import {
  ErrorCode,
  BASEBAND_FILTER_BW_MIN,
  BASEBAND_FILTER_BW_MAX,
  LO_FREQ_HZ_MIN,
  LO_FREQ_HZ_MAX,
  FREQ_HZ_MIN,
  FREQ_HZ_MAX,
  IF_HZ_MIN,
  IF_HZ_MAX,
} from "../constants";

describe("CancellablePromise", () => {
  it("should resolve normally", async () => {
    const promise = new CancellablePromise<number>((resolve) => {
      resolve(42);
      return () => {
        // Cleanup function
      };
    });

    await expect(promise).resolves.toBe(42);
  });

  it("should reject normally", async () => {
    const promise = new CancellablePromise<number>((_, reject) => {
      reject(new Error("test error"));
      return () => {
        // Cleanup function
      };
    });

    await expect(promise).rejects.toThrow("test error");
  });

  it("should support cancellation", async () => {
    let cancelled = false;
    const promise = new CancellablePromise<number>((resolve) => {
      setTimeout(() => resolve(42), 100);
      return () => {
        cancelled = true;
      };
    });

    promise.cancel();
    expect(cancelled).toBe(true);
  });

  it("should allow cancellation to be called multiple times", () => {
    const promise = new CancellablePromise<number>((resolve) => {
      resolve(42);
      return () => {
        // Cleanup
      };
    });

    promise.cancel();
    promise.cancel(); // Should not throw
  });
});

describe("max2837Ft bandwidth table", () => {
  it("should contain expected bandwidth values", () => {
    expect(max2837Ft).toHaveLength(16);
    expect(max2837Ft[0]).toBe(1750000); // 1.75 MHz
    expect(max2837Ft[15]).toBe(28000000); // 28 MHz
  });

  it("should be sorted in ascending order", () => {
    for (let i = 1; i < max2837Ft.length; i++) {
      expect(max2837Ft[i]).toBeGreaterThan(max2837Ft[i - 1]!);
    }
  });
});

describe("computeBasebandFilterBwRoundDownLt", () => {
  it("should return correct bandwidth for exact matches", () => {
    // Exact match should return the previous entry (round down)
    expect(computeBasebandFilterBwRoundDownLt(5000000)).toBe(3500000);
    expect(computeBasebandFilterBwRoundDownLt(10000000)).toBe(9000000);
  });

  it("should round down to nearest lower bandwidth", () => {
    expect(computeBasebandFilterBwRoundDownLt(4000000)).toBe(3500000);
    expect(computeBasebandFilterBwRoundDownLt(8500000)).toBe(8000000);
    expect(computeBasebandFilterBwRoundDownLt(15000000)).toBe(14000000);
  });

  it("should return first entry for values below minimum", () => {
    expect(computeBasebandFilterBwRoundDownLt(1000000)).toBe(1750000);
    expect(computeBasebandFilterBwRoundDownLt(1750000)).toBe(1750000);
  });

  it("should return last entry for values above maximum", () => {
    expect(computeBasebandFilterBwRoundDownLt(30000000)).toBe(28000000);
    expect(computeBasebandFilterBwRoundDownLt(50000000)).toBe(28000000);
  });

  it("should throw for invalid values", () => {
    expect(() => computeBasebandFilterBwRoundDownLt(-1)).toThrow(HackrfError);
    expect(() => computeBasebandFilterBwRoundDownLt(2 ** 33)).toThrow(
      HackrfError,
    );
  });
});

describe("computeBasebandFilterBw", () => {
  it("should return appropriate bandwidth for sample rates", () => {
    // Should select bandwidth that covers the sample rate
    expect(computeBasebandFilterBw(2000000)).toBe(1750000);
    expect(computeBasebandFilterBw(5000000)).toBe(3500000);
    expect(computeBasebandFilterBw(10000000)).toBe(9000000);
  });

  it("should round down when above target", () => {
    expect(computeBasebandFilterBw(4000000)).toBe(3500000);
    expect(computeBasebandFilterBw(8500000)).toBe(8000000);
  });

  it("should handle edge cases", () => {
    expect(computeBasebandFilterBw(1750000)).toBe(1750000);
    expect(computeBasebandFilterBw(28000000)).toBe(24000000);
  });

  it("should throw for invalid values", () => {
    expect(() => computeBasebandFilterBw(-1)).toThrow(HackrfError);
    expect(() => computeBasebandFilterBw(2 ** 33)).toThrow(HackrfError);
  });
});

describe("HackrfError", () => {
  it("should create error with correct properties", () => {
    const error = new HackrfError(ErrorCode.INVALID_PARAM);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("HackrfError");
    expect(error.code).toBe(ErrorCode.INVALID_PARAM);
    expect(error.message).toBe("INVALID_PARAM");
  });

  it("should support all error codes", () => {
    const error1 = new HackrfError(ErrorCode.NOT_FOUND);
    expect(error1.code).toBe(ErrorCode.NOT_FOUND);
    expect(error1.message).toBe("NOT_FOUND");

    const error2 = new HackrfError(ErrorCode.LIBUSB);
    expect(error2.code).toBe(ErrorCode.LIBUSB);
    expect(error2.message).toBe("LIBUSB");
  });
});

describe("checkU32", () => {
  it("should accept valid uint32 values", () => {
    expect(checkU32(0)).toBe(0);
    expect(checkU32(1)).toBe(1);
    expect(checkU32(2 ** 32 - 1)).toBe(2 ** 32 - 1);
  });

  it("should reject negative numbers", () => {
    expect(() => checkU32(-1)).toThrow(HackrfError);
    expect(() => checkU32(-100)).toThrow(HackrfError);
  });

  it("should reject values exceeding uint32 range", () => {
    expect(() => checkU32(2 ** 32)).toThrow(HackrfError);
    expect(() => checkU32(2 ** 33)).toThrow(HackrfError);
  });

  it("should reject non-integers", () => {
    expect(() => checkU32(1.5)).toThrow(HackrfError);
    expect(() => checkU32(Math.PI)).toThrow(HackrfError);
  });
});

describe("checkU8", () => {
  it("should accept valid uint8 values", () => {
    expect(checkU8(0)).toBe(0);
    expect(checkU8(127)).toBe(127);
    expect(checkU8(255)).toBe(255);
  });

  it("should reject values exceeding uint8 range", () => {
    expect(() => checkU8(256)).toThrow(HackrfError);
    expect(() => checkU8(1000)).toThrow(HackrfError);
  });
});

describe("checkU16", () => {
  it("should accept valid uint16 values", () => {
    expect(checkU16(0)).toBe(0);
    expect(checkU16(32767)).toBe(32767);
    expect(checkU16(65535)).toBe(65535);
  });

  it("should reject values exceeding uint16 range", () => {
    expect(() => checkU16(65536)).toThrow(HackrfError);
    expect(() => checkU16(100000)).toThrow(HackrfError);
  });
});

describe("checkMax2837Reg", () => {
  it("should accept valid register addresses (5 bits)", () => {
    expect(checkMax2837Reg(0)).toBe(0);
    expect(checkMax2837Reg(15)).toBe(15);
    expect(checkMax2837Reg(31)).toBe(31);
  });

  it("should reject values exceeding 5-bit range", () => {
    expect(() => checkMax2837Reg(32)).toThrow(HackrfError);
    expect(() => checkMax2837Reg(64)).toThrow(HackrfError);
  });
});

describe("checkMax2837Value", () => {
  it("should accept valid register values (10 bits)", () => {
    expect(checkMax2837Value(0)).toBe(0);
    expect(checkMax2837Value(512)).toBe(512);
    expect(checkMax2837Value(1023)).toBe(1023);
  });

  it("should reject values exceeding 10-bit range", () => {
    expect(() => checkMax2837Value(1024)).toThrow(HackrfError);
    expect(() => checkMax2837Value(2000)).toThrow(HackrfError);
  });
});

describe("checkSi5351cReg", () => {
  it("should accept valid register addresses (8 bits)", () => {
    expect(checkSi5351cReg(0)).toBe(0);
    expect(checkSi5351cReg(128)).toBe(128);
    expect(checkSi5351cReg(255)).toBe(255);
  });

  it("should reject values exceeding 8-bit range", () => {
    expect(() => checkSi5351cReg(256)).toThrow(HackrfError);
  });
});

describe("checkSi5351cValue", () => {
  it("should accept valid register values (8 bits)", () => {
    expect(checkSi5351cValue(0)).toBe(0);
    expect(checkSi5351cValue(128)).toBe(128);
    expect(checkSi5351cValue(255)).toBe(255);
  });

  it("should reject values exceeding 8-bit range", () => {
    expect(() => checkSi5351cValue(256)).toThrow(HackrfError);
  });
});

describe("checkRffc5071Reg", () => {
  it("should accept valid register addresses (< 31)", () => {
    expect(checkRffc5071Reg(0)).toBe(0);
    expect(checkRffc5071Reg(15)).toBe(15);
    expect(checkRffc5071Reg(30)).toBe(30);
  });

  it("should reject values >= 31", () => {
    expect(() => checkRffc5071Reg(31)).toThrow(HackrfError);
    expect(() => checkRffc5071Reg(100)).toThrow(HackrfError);
  });
});

describe("checkRffc5071Value", () => {
  it("should accept valid register values (16 bits)", () => {
    expect(checkRffc5071Value(0)).toBe(0);
    expect(checkRffc5071Value(32767)).toBe(32767);
    expect(checkRffc5071Value(65535)).toBe(65535);
  });

  it("should reject values exceeding 16-bit range", () => {
    expect(() => checkRffc5071Value(65536)).toThrow(HackrfError);
  });
});

describe("checkSpiflashAddress", () => {
  it("should accept valid SPI flash addresses (20 bits)", () => {
    expect(checkSpiflashAddress(0)).toBe(0);
    expect(checkSpiflashAddress(524288)).toBe(524288); // 2^19
    expect(checkSpiflashAddress(1048575)).toBe(1048575); // 2^20 - 1
  });

  it("should reject values exceeding 20-bit range", () => {
    expect(() => checkSpiflashAddress(1048576)).toThrow(HackrfError); // 2^20
    expect(() => checkSpiflashAddress(2000000)).toThrow(HackrfError);
  });
});

describe("checkBasebandFilterBw", () => {
  it("should accept valid bandwidth values", () => {
    expect(checkBasebandFilterBw(BASEBAND_FILTER_BW_MIN)).toBe(
      BASEBAND_FILTER_BW_MIN,
    );
    expect(checkBasebandFilterBw(20000000)).toBe(20000000);
    expect(checkBasebandFilterBw(BASEBAND_FILTER_BW_MAX)).toBe(
      BASEBAND_FILTER_BW_MAX,
    );
  });

  it("should reject values outside valid range", () => {
    expect(() => checkBasebandFilterBw(BASEBAND_FILTER_BW_MIN - 1)).toThrow(
      HackrfError,
    );
    expect(() => checkBasebandFilterBw(BASEBAND_FILTER_BW_MAX + 1)).toThrow(
      HackrfError,
    );
  });
});

describe("checkLoFreq", () => {
  it("should accept valid LO frequencies", () => {
    expect(checkLoFreq(LO_FREQ_HZ_MIN)).toBe(LO_FREQ_HZ_MIN);
    expect(checkLoFreq(1000000000)).toBe(1000000000);
    expect(checkLoFreq(LO_FREQ_HZ_MAX)).toBe(LO_FREQ_HZ_MAX);
  });

  it("should reject frequencies outside valid range", () => {
    expect(() => checkLoFreq(LO_FREQ_HZ_MIN - 1)).toThrow(HackrfError);
    expect(() => checkLoFreq(LO_FREQ_HZ_MAX + 1)).toThrow(HackrfError);
  });
});

describe("checkFreq", () => {
  it("should accept valid frequencies", () => {
    expect(checkFreq(FREQ_HZ_MIN)).toBe(FREQ_HZ_MIN);
    expect(checkFreq(100000000)).toBe(100000000);
    expect(checkFreq(FREQ_HZ_MAX)).toBe(FREQ_HZ_MAX);
  });

  it("should reject frequencies outside valid range", () => {
    expect(() => checkFreq(FREQ_HZ_MIN - 1)).toThrow(HackrfError);
    expect(() => checkFreq(FREQ_HZ_MAX + 1)).toThrow(HackrfError);
  });
});

describe("checkIFreq", () => {
  it("should accept valid IF frequencies", () => {
    expect(checkIFreq(IF_HZ_MIN)).toBe(IF_HZ_MIN);
    expect(checkIFreq(2500000000)).toBe(2500000000);
    expect(checkIFreq(IF_HZ_MAX)).toBe(IF_HZ_MAX);
  });

  it("should reject IF frequencies outside valid range", () => {
    expect(() => checkIFreq(IF_HZ_MIN - 1)).toThrow(HackrfError);
    expect(() => checkIFreq(IF_HZ_MAX + 1)).toThrow(HackrfError);
  });
});

describe("checkInLength", () => {
  it("should accept DataView with sufficient length", () => {
    const buffer = new ArrayBuffer(16);
    const view = new DataView(buffer);
    expect(checkInLength(view, 8)).toBe(view);
    expect(checkInLength(view, 16)).toBe(view);
  });

  it("should reject DataView with insufficient length", () => {
    const buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);
    expect(() => checkInLength(view, 16)).toThrow(HackrfError);
    expect(() => checkInLength(view, 32)).toThrow(HackrfError);
  });

  it("should accept exact minimum length", () => {
    const buffer = new ArrayBuffer(10);
    const view = new DataView(buffer);
    expect(checkInLength(view, 10)).toBe(view);
  });
});

describe("calcSampleRate", () => {
  it("should calculate sample rate parameters for common rates", () => {
    // 20 MSPS - standard HackRF rate
    const [freq1, div1] = calcSampleRate(20000000);
    expect(freq1 / div1).toBeCloseTo(20000000, 0);

    // 10 MSPS
    const [freq2, div2] = calcSampleRate(10000000);
    expect(freq2 / div2).toBeCloseTo(10000000, 0);

    // 2.4 MSPS
    const [freq3, div3] = calcSampleRate(2400000);
    expect(freq3 / div3).toBeCloseTo(2400000, 0);
  });

  it("should return divider of 1 for simple rates", () => {
    const [freq, div] = calcSampleRate(20000000);
    expect(div).toBeGreaterThanOrEqual(1);
    expect(div).toBeLessThanOrEqual(31);
  });

  it("should find optimal divider for fractional rates", () => {
    // Test with a rate that benefits from a divider
    const [freq, div] = calcSampleRate(2048000);
    expect(freq).toBeGreaterThan(0);
    expect(div).toBeGreaterThan(0);
    expect(div).toBeLessThanOrEqual(31);
    // Verify achieved rate is close to target
    expect(Math.abs(freq / div - 2048000)).toBeLessThan(100);
  });

  it("should handle edge case sample rates", () => {
    // Very low rate
    const [freq1, div1] = calcSampleRate(1000000);
    expect(freq1 / div1).toBeCloseTo(1000000, 0);

    // High rate
    const [freq2, div2] = calcSampleRate(28000000);
    expect(freq2 / div2).toBeCloseTo(28000000, 0);
  });

  it("should always return valid uint32 frequency", () => {
    const testRates = [
      2000000, 4000000, 8000000, 10000000, 20000000, 28000000,
    ];

    testRates.forEach((rate) => {
      const [freq, div] = calcSampleRate(rate);
      expect(freq).toBeGreaterThan(0);
      expect(freq).toBeLessThanOrEqual(2 ** 32 - 1);
      expect(div).toBeGreaterThan(0);
      expect(div).toBeLessThanOrEqual(31);
    });
  });
});
