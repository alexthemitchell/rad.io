/**
 * Tests for Spectrum component marker functionality
 */

import { render, fireEvent, waitFor } from "@testing-library/react";
import Spectrum from "../Spectrum";
import { useStore } from "../../../store";

// Mock the store
jest.mock("../../../store", () => ({
  useStore: jest.fn(),
  useMarkers: jest.fn(),
}));

describe("Spectrum markers", () => {
  const createMagnitudes = (size: number): Float32Array => {
    const mags = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      mags[i] = -80 + Math.sin((i * Math.PI) / size) * 40;
    }
    return mags;
  };

  const mockAddMarker = jest.fn();
  const mockUpdateMarker = jest.fn();
  const mockRemoveMarker = jest.fn();
  const mockClearMarkers = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock useStore for VFO frequency
    (useStore as unknown as jest.Mock).mockImplementation((selector) => {
      if (typeof selector === "function") {
        return selector({ frequencyHz: 100e6 });
      }
      return { frequencyHz: 100e6 };
    });

    // Mock useMarkers
    const { useMarkers } = require("../../../store");
    useMarkers.mockReturnValue({
      markers: [],
      nextMarkerNumber: 1,
      addMarker: mockAddMarker,
      updateMarker: mockUpdateMarker,
      removeMarker: mockRemoveMarker,
      clearMarkers: mockClearMarkers,
    });

    // Mock console methods
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("marker placement", () => {
    it("should not enable markers by default", () => {
      const magnitudes = createMagnitudes(1024);
      const { container } = render(
        <Spectrum
          magnitudes={magnitudes}
          sampleRate={2e6}
          centerFrequency={100e6}
        />,
      );

      const overlayCanvas = container.querySelectorAll("canvas")[1];
      expect(overlayCanvas).toHaveStyle({ pointerEvents: "none" });
    });

    it("should enable pointer events when enableMarkers is true", () => {
      const magnitudes = createMagnitudes(1024);
      const { container } = render(
        <Spectrum
          magnitudes={magnitudes}
          sampleRate={2e6}
          centerFrequency={100e6}
          enableMarkers={true}
        />,
      );

      const overlayCanvas = container.querySelectorAll("canvas")[1];
      expect(overlayCanvas).toHaveStyle({ pointerEvents: "auto" });
    });

    it("should have accessible aria-label when markers enabled", () => {
      const magnitudes = createMagnitudes(1024);
      const { container } = render(
        <Spectrum
          magnitudes={magnitudes}
          sampleRate={2e6}
          centerFrequency={100e6}
          enableMarkers={true}
        />,
      );

      const overlayCanvas = container.querySelectorAll("canvas")[1];
      expect(overlayCanvas).toHaveAttribute("aria-label");
      expect(overlayCanvas?.getAttribute("aria-label")).toContain("markers");
    });

    it("should add marker on click", async () => {
      const magnitudes = createMagnitudes(1024);
      const { container } = render(
        <Spectrum
          magnitudes={magnitudes}
          sampleRate={2e6}
          centerFrequency={100e6}
          enableMarkers={true}
        />,
      );

      const overlayCanvas = container.querySelectorAll("canvas")[1];
      if (!overlayCanvas) {
        throw new Error("Overlay canvas not found");
      }

      // Simulate click in middle of canvas
      fireEvent.click(overlayCanvas, {
        clientX: 375, // Middle of 750px wide canvas
        clientY: 200,
      });

      await waitFor(() => {
        expect(mockAddMarker).toHaveBeenCalled();
      });
    });

    it("should add marker with keyboard shortcut M", async () => {
      const magnitudes = createMagnitudes(1024);
      const { container } = render(
        <Spectrum
          magnitudes={magnitudes}
          sampleRate={2e6}
          centerFrequency={100e6}
          enableMarkers={true}
        />,
      );

      const overlayCanvas = container.querySelectorAll("canvas")[1];
      if (!overlayCanvas) {
        throw new Error("Overlay canvas not found");
      }

      // Press 'M' key
      fireEvent.keyDown(overlayCanvas, { key: "M" });

      await waitFor(() => {
        expect(mockAddMarker).toHaveBeenCalled();
      });
    });

    it("should delete marker on right-click", async () => {
      const testMarker = {
        id: "marker-1",
        label: "M1",
        freqHz: 100e6,
        powerDb: -40,
      };

      const { useMarkers } = require("../../../store");
      useMarkers.mockReturnValue({
        markers: [testMarker],
        nextMarkerNumber: 2,
        addMarker: mockAddMarker,
        updateMarker: mockUpdateMarker,
        removeMarker: mockRemoveMarker,
        clearMarkers: mockClearMarkers,
      });

      const magnitudes = createMagnitudes(1024);
      const { container } = render(
        <Spectrum
          magnitudes={magnitudes}
          sampleRate={2e6}
          centerFrequency={100e6}
          enableMarkers={true}
        />,
      );

      const overlayCanvas = container.querySelectorAll("canvas")[1];
      if (!overlayCanvas) {
        throw new Error("Overlay canvas not found");
      }

      // Mock getBoundingClientRect for precise positioning
      Object.defineProperty(overlayCanvas, "getBoundingClientRect", {
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

      // Calculate marker position: center frequency = 100 MHz
      // Sample rate = 2 MHz, so range is 99-101 MHz
      // Marker at 100 MHz is at center
      const margin = { left: 80, right: 40 };
      const chartWidth = 750 - margin.left - margin.right;
      const markerX = margin.left + chartWidth / 2; // Center position

      // Right-click at marker position
      fireEvent.contextMenu(overlayCanvas, {
        clientX: markerX,
        clientY: 200,
      });

      // Right-click should be prevented and marker removed
      await waitFor(() => {
        expect(mockRemoveMarker).toHaveBeenCalledWith("marker-1");
      });
    });
  });

  describe("marker limits", () => {
    it("should not add more than 10 markers", async () => {
      const markers = Array.from({ length: 10 }, (_, i) => ({
        id: `marker-${i}`,
        label: `M${i + 1}`,
        freqHz: 99e6 + i * 0.2e6,
        powerDb: -40 - i,
      }));

      const { useMarkers } = require("../../../store");
      useMarkers.mockReturnValue({
        markers,
        nextMarkerNumber: 11,
        addMarker: mockAddMarker,
        updateMarker: mockUpdateMarker,
        removeMarker: mockRemoveMarker,
        clearMarkers: mockClearMarkers,
      });

      const magnitudes = createMagnitudes(1024);
      const { container } = render(
        <Spectrum
          magnitudes={magnitudes}
          sampleRate={2e6}
          centerFrequency={100e6}
          enableMarkers={true}
        />,
      );

      const overlayCanvas = container.querySelectorAll("canvas")[1];
      if (!overlayCanvas) {
        throw new Error("Overlay canvas not found");
      }

      // Try to add 11th marker
      fireEvent.click(overlayCanvas, {
        clientX: 400,
        clientY: 200,
      });

      await waitFor(() => {
        // Should not call addMarker when limit reached
        expect(mockAddMarker).not.toHaveBeenCalled();
      });
    });
  });

  describe("marker rendering", () => {
    it("should render markers from store", () => {
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

      const { useMarkers } = require("../../../store");
      useMarkers.mockReturnValue({
        markers,
        nextMarkerNumber: 3,
        addMarker: mockAddMarker,
        updateMarker: mockUpdateMarker,
        removeMarker: mockRemoveMarker,
        clearMarkers: mockClearMarkers,
      });

      const magnitudes = createMagnitudes(1024);
      const { container } = render(
        <Spectrum
          magnitudes={magnitudes}
          sampleRate={2e6}
          centerFrequency={100e6}
          enableMarkers={true}
        />,
      );

      const overlayCanvas = container.querySelectorAll("canvas")[1];
      expect(overlayCanvas).toBeInTheDocument();
    });
  });

  describe("without sampleRate or centerFrequency", () => {
    it("should not render overlay canvas when sampleRate missing", () => {
      const magnitudes = createMagnitudes(1024);
      const { container } = render(
        <Spectrum magnitudes={magnitudes} enableMarkers={true} />,
      );

      const canvases = container.querySelectorAll("canvas");
      expect(canvases).toHaveLength(1); // Only main canvas
    });

    it("should not enable markers when centerFrequency missing", () => {
      const magnitudes = createMagnitudes(1024);
      const { container } = render(
        <Spectrum
          magnitudes={magnitudes}
          sampleRate={2e6}
          enableMarkers={true}
        />,
      );

      const canvases = container.querySelectorAll("canvas");
      expect(canvases).toHaveLength(1); // Only main canvas
    });
  });
});
