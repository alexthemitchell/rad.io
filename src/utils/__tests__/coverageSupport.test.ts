import { classifyNumber, toMask, summarize, categorizeDb, clamp } from "../coverageSupport";

describe("coverageSupport", () => {
  it("classifies numbers across ranges", () => {
    expect(classifyNumber(-1)).toBe("neg");
    expect(classifyNumber(0)).toBe("zero");
    expect(classifyNumber(5)).toBe("small");
    expect(classifyNumber(50)).toBe("medium");
    expect(classifyNumber(500)).toBe("large");
  });

  it("creates bitmask for all flag combinations", () => {
    // Exercise both true/false paths for each flag
    expect(toMask({ a: false, b: false, c: false })).toBe(0);
    expect(toMask({ a: true, b: false, c: false })).toBe(1);
    expect(toMask({ a: false, b: true, c: false })).toBe(2);
    expect(toMask({ a: false, b: false, c: true })).toBe(4);
    expect(toMask({ a: true, b: true, c: true })).toBe(1 | 2 | 4);
  });

  it("summarizes sequences and detects negatives", () => {
    const res1 = summarize([1, 2, 3]);
    expect(res1.allPositive).toBe(true);
    expect(res1.counts["small"]).toBe(3);

    const res2 = summarize([-1, 0, 10, 100]);
    expect(res2.allPositive).toBe(false);
    expect(res2.counts["neg"]).toBe(1);
    expect(res2.counts["zero"]).toBe(1);
    expect(res2.counts["medium"]).toBe(1);
    expect(res2.counts["large"]).toBe(1);
  });

  it("categorizes dB ranges and clamps numbers", () => {
    expect(categorizeDb(-80)).toBe("low");
    expect(categorizeDb(-20)).toBe("mid");
    expect(categorizeDb(-1)).toBe("high");
    expect(categorizeDb(1)).toBe("clip");

    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(15, 0, 10)).toBe(10);
  });
});
