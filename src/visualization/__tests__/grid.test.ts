import { determineGridSpacing, getGridLabelFormatter } from "../grid";

describe("determineGridSpacing", () => {
  it("returns a valid spacing and formatter for 4MHz bandwidth", () => {
    const bw = 4e6;
    const chartWidth = 1100;
    const { spacing, formatter } = determineGridSpacing(bw, chartWidth);
    expect(spacing).toBeGreaterThan(0);
    const label = formatter(2.5e6);
    expect(typeof label).toBe("string");
  });

  it("uses kHz spacing for narrower bandwidths", () => {
    const bw = 200e3; // 200 kHz
    const chartWidth = 1100;
    const { spacing, formatter } = determineGridSpacing(bw, chartWidth);
    expect(spacing).toBeGreaterThan(0);
    expect(formatter(100000)).toContain("kHz");
  });
});

describe("getGridLabelFormatter", () => {
  it("formats kHz correctly", () => {
    const f = getGridLabelFormatter(50e3);
    expect(f(100e3)).toContain("kHz");
  });
  it("formats MHz correctly", () => {
    const f = getGridLabelFormatter(2e6);
    expect(f(2.5e6)).toContain("MHz");
  });
});
