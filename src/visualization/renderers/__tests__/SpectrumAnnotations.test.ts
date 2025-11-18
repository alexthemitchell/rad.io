import { isSignalVisibleForAnnotation } from "../SpectrumAnnotations";
import { SpectrumAnnotations } from "../SpectrumAnnotations";

describe("isSignalVisibleForAnnotation", () => {
  const freqMin = 100e6 - 1e6; // example center 100MHz
  const freqMax = 100e6 + 1e6;
  const now = Date.now();

  it("shows active signal in range", () => {
    const signal: any = {
      frequency: 100e6,
      isActive: true,
      lastSeen: now - 1000,
    };
    expect(isSignalVisibleForAnnotation(signal, freqMin, freqMax, now)).toBe(
      true,
    );
  });

  it("hides inactive signal out of range", () => {
    const signal: any = {
      frequency: 102e6,
      isActive: false,
      lastSeen: now - 1000,
    };
    expect(isSignalVisibleForAnnotation(signal, freqMin, freqMax, now)).toBe(
      false,
    );
  });

  it("hides inactive signal in range but too old", () => {
    const signal: any = {
      frequency: 100e6,
      isActive: false,
      lastSeen: now - 60000,
    };
    expect(isSignalVisibleForAnnotation(signal, freqMin, freqMax, now)).toBe(
      false,
    );
  });

  it("shows inactive signal in range if recently seen", () => {
    const signal: any = {
      frequency: 100e6,
      isActive: false,
      lastSeen: now - 2000,
    };
    expect(isSignalVisibleForAnnotation(signal, freqMin, freqMax, now)).toBe(
      true,
    );
  });
});

describe("SpectrumAnnotations gridlines", () => {
  it("renders gridlines without crashing", () => {
    // Setup a DOM canvas for the renderer
    const canvas = document.createElement("canvas");
    canvas.width = 900;
    canvas.height = 320;
    const renderer = new SpectrumAnnotations();
    expect(renderer.initialize(canvas)).toBeTruthy();
    const width = 900;
    const height = 320;
    const center = 100e6;
    const sampleRate = 2e6;
    const freqMin = center - sampleRate / 2;
    const freqMax = center + sampleRate / 2;

    // Should return true and not throw
    expect(
      renderer.renderGridlines(
        width,
        height,
        freqMin,
        freqMax,
        center,
        sampleRate,
      ),
    ).toBeTruthy();
  });
});

describe("SpectrumAnnotations VFO cursor", () => {
  let canvas: HTMLCanvasElement;
  let renderer: SpectrumAnnotations;

  beforeEach(() => {
    canvas = document.createElement("canvas");
    canvas.width = 900;
    canvas.height = 320;
    renderer = new SpectrumAnnotations();
    renderer.initialize(canvas);
  });

  afterEach(() => {
    renderer.cleanup();
  });

  it("renders VFO cursor at center frequency", () => {
    const vfoFrequency = 100e6;
    const sampleRate = 2e6;
    const centerFrequency = 100e6;

    const result = renderer.renderVFOCursor(
      vfoFrequency,
      sampleRate,
      centerFrequency,
    );

    expect(result).toBe(true);
  });

  it("renders VFO cursor at edge of spectrum", () => {
    const sampleRate = 2e6;
    const centerFrequency = 100e6;
    const vfoFrequency = centerFrequency - sampleRate / 2 + 100e3; // Near left edge

    const result = renderer.renderVFOCursor(
      vfoFrequency,
      sampleRate,
      centerFrequency,
    );

    expect(result).toBe(true);
  });

  it("handles VFO cursor outside visible range", () => {
    const sampleRate = 2e6;
    const centerFrequency = 100e6;
    const vfoFrequency = 150e6; // Far outside range

    const result = renderer.renderVFOCursor(
      vfoFrequency,
      sampleRate,
      centerFrequency,
    );

    // Should return true (not an error), just not visible
    expect(result).toBe(true);
  });

  it("handles invalid frequencies gracefully", () => {
    const result = renderer.renderVFOCursor(NaN, 2e6, 100e6);
    expect(result).toBe(true); // Should not crash
  });

  it("returns false when not initialized", () => {
    const uninitializedRenderer = new SpectrumAnnotations();
    const result = uninitializedRenderer.renderVFOCursor(100e6, 2e6, 100e6);
    expect(result).toBe(false);
  });
});
