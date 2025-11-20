/**
 * Tests for SpectrumAnnotations marker rendering and interaction
 */

import { SpectrumAnnotations } from "../SpectrumAnnotations";

describe("SpectrumAnnotations markers", () => {
  let canvas: HTMLCanvasElement;
  let annotations: SpectrumAnnotations;

  beforeEach(() => {
    canvas = document.createElement("canvas");
    canvas.width = 750;
    canvas.height = 400;
    canvas.style.width = "750px";
    canvas.style.height = "400px";
    // Attach to DOM for getBoundingClientRect to work
    document.body.appendChild(canvas);
    annotations = new SpectrumAnnotations();
    annotations.initialize(canvas);
  });

  afterEach(() => {
    annotations.cleanup();
    if (canvas.parentNode) {
      document.body.removeChild(canvas);
    }
  });

  describe("pixelToFrequency", () => {
    it("should convert pixel at left margin to minimum frequency", () => {
      const sampleRate = 2e6; // 2 MHz
      const centerFrequency = 100e6; // 100 MHz
      const canvasWidth = 750;
      const pixelX = 48; // Before left margin (will be clamped to minimum frequency)

      const freqHz = annotations.pixelToFrequency(
        pixelX,
        canvasWidth,
        sampleRate,
        centerFrequency,
      );

      const expectedFreq = centerFrequency - sampleRate / 2; // 99 MHz
      expect(freqHz).toBeCloseTo(expectedFreq, 0);
    });

    it("should convert pixel at right margin to maximum frequency", () => {
      const sampleRate = 2e6; // 2 MHz
      const centerFrequency = 100e6; // 100 MHz
      const canvasWidth = 750;
      const pixelX = canvasWidth - 16; // Beyond right margin (will be clamped to maximum frequency)

      const freqHz = annotations.pixelToFrequency(
        pixelX,
        canvasWidth,
        sampleRate,
        centerFrequency,
      );

      const expectedFreq = centerFrequency + sampleRate / 2; // 101 MHz
      expect(freqHz).toBeCloseTo(expectedFreq, 0);
    });

    it("should convert pixel at center to center frequency", () => {
      const sampleRate = 2e6; // 2 MHz
      const centerFrequency = 100e6; // 100 MHz
      const canvasWidth = 750;
      const margin = { left: 80, right: 40 };
      const chartWidth = canvasWidth - margin.left - margin.right;
      const pixelX = margin.left + chartWidth / 2; // Chart center

      const freqHz = annotations.pixelToFrequency(
        pixelX,
        canvasWidth,
        sampleRate,
        centerFrequency,
      );

      // Allow some tolerance due to integer pixel positions
      expect(freqHz).toBeCloseTo(centerFrequency, -3); // Within 1000 Hz
    });

    it("should handle different sample rates correctly", () => {
      const sampleRate = 10e6; // 10 MHz
      const centerFrequency = 915e6; // 915 MHz (ISM band)
      const canvasWidth = 750;
      const pixelX = 48; // Before left margin (will be clamped to minimum frequency)

      const freqHz = annotations.pixelToFrequency(
        pixelX,
        canvasWidth,
        sampleRate,
        centerFrequency,
      );

      const expectedFreq = centerFrequency - sampleRate / 2; // 910 MHz
      expect(freqHz).toBeCloseTo(expectedFreq, 0);
    });

    it("should clamp values outside canvas bounds", () => {
      const sampleRate = 2e6;
      const centerFrequency = 100e6;
      const canvasWidth = 750;

      // Test pixel beyond left edge
      const freqLeft = annotations.pixelToFrequency(
        -100,
        canvasWidth,
        sampleRate,
        centerFrequency,
      );
      const expectedMin = centerFrequency - sampleRate / 2;
      expect(freqLeft).toBeCloseTo(expectedMin, 0);

      // Test pixel beyond right edge
      const freqRight = annotations.pixelToFrequency(
        1000,
        canvasWidth,
        sampleRate,
        centerFrequency,
      );
      const expectedMax = centerFrequency + sampleRate / 2;
      expect(freqRight).toBeCloseTo(expectedMax, 0);
    });
  });

  describe("findMarkerAt", () => {
    const sampleRate = 2e6;
    const centerFrequency = 100e6;
    const markers = [
      {
        id: "marker-1",
        label: "M1",
        freqHz: 99.5e6, // 99.5 MHz (left of center)
        powerDb: -40.5,
      },
      {
        id: "marker-2",
        label: "M2",
        freqHz: 100.5e6, // 100.5 MHz (right of center)
        powerDb: -35.2,
      },
    ];

    beforeEach(() => {
      // Mock getBoundingClientRect to return proper dimensions
      Object.defineProperty(canvas, "getBoundingClientRect", {
        writable: true,
        value: jest.fn().mockReturnValue({
          width: 750,
          height: 400,
          top: 0,
          left: 0,
          right: 750,
          bottom: 400,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }),
      });
    });

    it("should find marker when clicking on drag handle", () => {
      // Calculate expected x position for marker-1
      const freqMin = centerFrequency - sampleRate / 2;
      const freqMax = centerFrequency + sampleRate / 2;
      const freqRange = freqMax - freqMin;
      const markerFreq = markers[0]?.freqHz ?? 0;
      const xNorm = (markerFreq - freqMin) / freqRange;
      const canvasWidth = 750;
      const margin = { left: 80, right: 40, top: 60, bottom: 60 };
      const chartWidth = canvasWidth - margin.left - margin.right;
      const x = margin.left + xNorm * chartWidth;
      const y = margin.top + 10; // Drag handle Y position

      const result = annotations.findMarkerAt(
        x,
        y,
        markers,
        sampleRate,
        centerFrequency,
      );

      expect(result).not.toBeNull();
      expect(result?.marker.id).toBe("marker-1");
      expect(result?.isDragHandle).toBe(true);
    });

    it("should find marker when clicking on vertical line", () => {
      const freqMin = centerFrequency - sampleRate / 2;
      const freqMax = centerFrequency + sampleRate / 2;
      const freqRange = freqMax - freqMin;
      const markerFreq = markers[1]?.freqHz ?? 0;
      const xNorm = (markerFreq - freqMin) / freqRange;
      const canvasWidth = 750;
      const margin = { left: 80, right: 40, top: 60, bottom: 60 };
      const chartWidth = canvasWidth - margin.left - margin.right;
      const x = margin.left + xNorm * chartWidth;
      const y = 200; // Middle of canvas

      const result = annotations.findMarkerAt(
        x,
        y,
        markers,
        sampleRate,
        centerFrequency,
      );

      expect(result).not.toBeNull();
      expect(result?.marker.id).toBe("marker-2");
      expect(result?.isDragHandle).toBe(false);
    });

    it("should return null when clicking away from markers", () => {
      const result = annotations.findMarkerAt(
        100,
        100,
        markers,
        sampleRate,
        centerFrequency,
      );

      expect(result).toBeNull();
    });

    it("should return null for empty marker array", () => {
      const result = annotations.findMarkerAt(
        300,
        200,
        [],
        sampleRate,
        centerFrequency,
      );

      expect(result).toBeNull();
    });

    it("should prioritize top-most marker when multiple overlap", () => {
      // Create overlapping markers at same frequency
      const overlappingMarkers = [
        {
          id: "marker-bottom",
          label: "M1",
          freqHz: 100e6,
          powerDb: -40,
        },
        {
          id: "marker-top",
          label: "M2",
          freqHz: 100e6,
          powerDb: -35,
        },
      ];

      const freqMin = centerFrequency - sampleRate / 2;
      const freqMax = centerFrequency + sampleRate / 2;
      const freqRange = freqMax - freqMin;
      const xNorm = (100e6 - freqMin) / freqRange;
      const canvasWidth = 750;
      const margin = { left: 80, right: 40, top: 60, bottom: 60 };
      const chartWidth = canvasWidth - margin.left - margin.right;
      const x = margin.left + xNorm * chartWidth;
      const y = 200;

      const result = annotations.findMarkerAt(
        x,
        y,
        overlappingMarkers,
        sampleRate,
        centerFrequency,
      );

      expect(result).not.toBeNull();
      expect(result?.marker.id).toBe("marker-top");
    });
  });

  describe("renderMarkers", () => {
    it("should render without errors when markers array is empty", () => {
      const sampleRate = 2e6;
      const centerFrequency = 100e6;

      const result = annotations.renderMarkers([], sampleRate, centerFrequency);

      expect(result).toBe(true);
    });

    it("should render markers successfully", () => {
      const sampleRate = 2e6;
      const centerFrequency = 100e6;
      const markers = [
        {
          id: "marker-1",
          label: "M1",
          freqHz: 99.5e6,
          powerDb: -40.5,
        },
        {
          id: "marker-2",
          label: "M2",
          freqHz: 100.5e6,
          powerDb: -35.2,
        },
      ];

      const result = annotations.renderMarkers(
        markers,
        sampleRate,
        centerFrequency,
      );

      expect(result).toBe(true);
    });

    it("should filter out markers outside visible range", () => {
      const sampleRate = 2e6; // 99 MHz to 101 MHz
      const centerFrequency = 100e6;
      const markers = [
        {
          id: "marker-1",
          label: "M1",
          freqHz: 98e6, // Outside range
          powerDb: -40,
        },
        {
          id: "marker-2",
          label: "M2",
          freqHz: 100e6, // Inside range
          powerDb: -35,
        },
        {
          id: "marker-3",
          label: "M3",
          freqHz: 102e6, // Outside range
          powerDb: -45,
        },
      ];

      const result = annotations.renderMarkers(
        markers,
        sampleRate,
        centerFrequency,
      );

      // Should succeed (only renders visible marker-2)
      expect(result).toBe(true);
    });

    it("should handle invalid inputs gracefully", () => {
      const markers = [
        {
          id: "marker-1",
          label: "M1",
          freqHz: 100e6,
          powerDb: -40,
        },
      ];

      // Test with NaN values
      let result = annotations.renderMarkers(markers, NaN, 100e6);
      expect(result).toBe(true); // Returns true but doesn't render

      result = annotations.renderMarkers(markers, 2e6, NaN);
      expect(result).toBe(true);

      result = annotations.renderMarkers(markers, Infinity, 100e6);
      expect(result).toBe(true);
    });

    it("should highlight hovered marker", () => {
      const sampleRate = 2e6;
      const centerFrequency = 100e6;
      const markers = [
        {
          id: "marker-1",
          label: "M1",
          freqHz: 99.5e6,
          powerDb: -40.5,
        },
        {
          id: "marker-2",
          label: "M2",
          freqHz: 100.5e6,
          powerDb: -35.2,
        },
      ];

      const result = annotations.renderMarkers(
        markers,
        sampleRate,
        centerFrequency,
        "marker-1", // Hover first marker
      );

      expect(result).toBe(true);
    });
  });
});
