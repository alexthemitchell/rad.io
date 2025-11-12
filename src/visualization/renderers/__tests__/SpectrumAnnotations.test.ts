import { isSignalVisibleForAnnotation } from "../SpectrumAnnotations";

describe("isSignalVisibleForAnnotation", () => {
  const freqMin = 100e6 - 1e6; // example center 100MHz
  const freqMax = 100e6 + 1e6;
  const now = Date.now();

  it("shows active signal in range", () => {
    const signal: any = { frequency: 100e6, isActive: true, lastSeen: now - 1000 };
    expect(isSignalVisibleForAnnotation(signal, freqMin, freqMax, now)).toBe(true);
  });

  it("hides inactive signal out of range", () => {
    const signal: any = { frequency: 102e6, isActive: false, lastSeen: now - 1000 };
    expect(isSignalVisibleForAnnotation(signal, freqMin, freqMax, now)).toBe(false);
  });

  it("hides inactive signal in range but too old", () => {
    const signal: any = { frequency: 100e6, isActive: false, lastSeen: now - 60000 };
    expect(isSignalVisibleForAnnotation(signal, freqMin, freqMax, now)).toBe(false);
  });

  it("shows inactive signal in range if recently seen", () => {
    const signal: any = { frequency: 100e6, isActive: false, lastSeen: now - 2000 };
    expect(isSignalVisibleForAnnotation(signal, freqMin, freqMax, now)).toBe(true);
  });
});
