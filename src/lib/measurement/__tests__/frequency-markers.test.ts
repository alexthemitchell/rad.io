/**
 * Frequency Marker Tests
 */

import { FrequencyMarkerManager } from "../frequency-markers";
import type { FrequencyMarker } from "../types";

describe("FrequencyMarkerManager", () => {
  let manager: FrequencyMarkerManager;

  beforeEach(() => {
    manager = new FrequencyMarkerManager();
  });

  describe("addMarker", () => {
    it("should add a marker with auto-generated ID", () => {
      const marker = manager.addMarker(100e6);

      expect(marker.id).toBe("M1");
      expect(marker.frequency).toBe(100e6);
      expect(marker.active).toBe(true);
    });

    it("should add marker with custom label and color", () => {
      const marker = manager.addMarker(
        100e6,
        "Test Marker",
        "#FF0000",
      );

      expect(marker.label).toBe("Test Marker");
      expect(marker.color).toBe("#FF0000");
    });

    it("should throw error when exceeding max markers", () => {
      const smallManager = new FrequencyMarkerManager({
        maxMarkers: 2,
      });

      smallManager.addMarker(100e6);
      smallManager.addMarker(200e6);

      expect(() => smallManager.addMarker(300e6)).toThrow();
    });

    it("should auto-assign colors to markers", () => {
      const marker1 = manager.addMarker(100e6);
      const marker2 = manager.addMarker(200e6);

      expect(marker1.color).toBeDefined();
      expect(marker2.color).toBeDefined();
      expect(marker1.color).not.toBe(marker2.color);
    });
  });

  describe("removeMarker", () => {
    it("should remove an existing marker", () => {
      const marker = manager.addMarker(100e6);
      const removed = manager.removeMarker(marker.id);

      expect(removed).toBe(true);
      expect(manager.getMarker(marker.id)).toBeUndefined();
    });

    it("should return false for non-existent marker", () => {
      const removed = manager.removeMarker("nonexistent");
      expect(removed).toBe(false);
    });
  });

  describe("updateMarkerFrequency", () => {
    it("should update marker frequency", () => {
      const marker = manager.addMarker(100e6);
      const updated = manager.updateMarkerFrequency(
        marker.id,
        200e6,
      );

      expect(updated).toBe(true);
      const retrievedMarker = manager.getMarker(marker.id);
      expect(retrievedMarker?.frequency).toBe(200e6);
    });

    it("should return false for non-existent marker", () => {
      const updated = manager.updateMarkerFrequency(
        "nonexistent",
        100e6,
      );
      expect(updated).toBe(false);
    });
  });

  describe("updateMarkerPower", () => {
    it("should update marker power", () => {
      const marker = manager.addMarker(100e6);
      const updated = manager.updateMarkerPower(marker.id, -30);

      expect(updated).toBe(true);
      const retrievedMarker = manager.getMarker(marker.id);
      expect(retrievedMarker?.power).toBe(-30);
    });
  });

  describe("getAllMarkers", () => {
    it("should return all markers", () => {
      manager.addMarker(100e6);
      manager.addMarker(200e6);
      manager.addMarker(300e6);

      const markers = manager.getAllMarkers();
      expect(markers).toHaveLength(3);
    });

    it("should return empty array when no markers", () => {
      const markers = manager.getAllMarkers();
      expect(markers).toHaveLength(0);
    });
  });

  describe("getActiveMarkers", () => {
    it("should return only active markers", () => {
      const marker1 = manager.addMarker(100e6);
      manager.addMarker(200e6);
      const marker3 = manager.addMarker(300e6);

      manager.toggleMarkerActive(marker1.id);

      const activeMarkers = manager.getActiveMarkers();
      expect(activeMarkers).toHaveLength(2);
    });
  });

  describe("clearMarkers", () => {
    it("should remove all markers", () => {
      manager.addMarker(100e6);
      manager.addMarker(200e6);

      manager.clearMarkers();

      expect(manager.getAllMarkers()).toHaveLength(0);
    });

    it("should reset marker ID counter", () => {
      manager.addMarker(100e6);
      manager.clearMarkers();

      const newMarker = manager.addMarker(200e6);
      expect(newMarker.id).toBe("M1");
    });
  });

  describe("trackPeakInRange", () => {
    it("should move marker to peak frequency", () => {
      const marker = manager.addMarker(100e6);

      const spectrum = new Float32Array([
        -50, -45, -30, -60, -70,
      ]);
      const frequencies = new Float32Array([
        99.9e6, 99.95e6, 100e6, 100.05e6, 100.1e6,
      ]);

      const tracked = manager.trackPeakInRange(
        marker.id,
        spectrum,
        frequencies,
        200e3,
      );

      expect(tracked).toBe(true);
      const updatedMarker = manager.getMarker(marker.id);
      expect(updatedMarker?.frequency).toBe(100e6);
      expect(updatedMarker?.power).toBe(-30);
    });

    it("should handle markers outside frequency range", () => {
      const marker = manager.addMarker(100e6);

      const spectrum = new Float32Array([-50, -45, -40]);
      const frequencies = new Float32Array([
        200e6, 200.1e6, 200.2e6,
      ]);

      const tracked = manager.trackPeakInRange(
        marker.id,
        spectrum,
        frequencies,
        10e3,
      );

      // The marker is outside range but will find the closest frequency
      expect(tracked).toBe(true);
    });
  });

  describe("calculateDelta", () => {
    it("should calculate frequency delta between markers", () => {
      const marker1 = manager.addMarker(100e6);
      const marker2 = manager.addMarker(150e6);

      const delta = manager.calculateDelta(marker1.id, marker2.id);

      expect(delta).not.toBeNull();
      expect(delta?.frequencyDelta).toBe(50e6);
    });

    it("should calculate power delta between markers", () => {
      const marker1 = manager.addMarker(100e6);
      const marker2 = manager.addMarker(150e6);

      manager.updateMarkerPower(marker1.id, -40);
      manager.updateMarkerPower(marker2.id, -30);

      const delta = manager.calculateDelta(marker1.id, marker2.id);

      expect(delta?.powerDelta).toBe(10);
    });

    it("should return null for non-existent markers", () => {
      const marker = manager.addMarker(100e6);
      const delta = manager.calculateDelta(marker.id, "nonexistent");

      expect(delta).toBeNull();
    });
  });

  describe("updateMarkersFromSpectrum", () => {
    it("should update all active marker powers", () => {
      const marker1 = manager.addMarker(100e6);
      const marker2 = manager.addMarker(200e6);

      const spectrum = new Float32Array([-40, -30, -50]);
      const frequencies = new Float32Array([
        100e6, 150e6, 200e6,
      ]);

      manager.updateMarkersFromSpectrum(spectrum, frequencies);

      expect(manager.getMarker(marker1.id)?.power).toBe(-40);
      expect(manager.getMarker(marker2.id)?.power).toBe(-50);
    });

    it("should not update inactive markers", () => {
      const marker = manager.addMarker(100e6);
      manager.toggleMarkerActive(marker.id);

      const spectrum = new Float32Array([-40]);
      const frequencies = new Float32Array([100e6]);

      manager.updateMarkersFromSpectrum(spectrum, frequencies);

      expect(manager.getMarker(marker.id)?.power).toBeUndefined();
    });
  });

  describe("toggleMarkerActive", () => {
    it("should toggle marker active state", () => {
      const marker = manager.addMarker(100e6);
      expect(marker.active).toBe(true);

      manager.toggleMarkerActive(marker.id);
      expect(manager.getMarker(marker.id)?.active).toBe(false);

      manager.toggleMarkerActive(marker.id);
      expect(manager.getMarker(marker.id)?.active).toBe(true);
    });
  });

  describe("setMarkerLabel", () => {
    it("should update marker label", () => {
      const marker = manager.addMarker(100e6);
      const updated = manager.setMarkerLabel(
        marker.id,
        "New Label",
      );

      expect(updated).toBe(true);
      expect(manager.getMarker(marker.id)?.label).toBe(
        "New Label",
      );
    });
  });

  describe("setMarkerColor", () => {
    it("should update marker color", () => {
      const marker = manager.addMarker(100e6);
      const updated = manager.setMarkerColor(
        marker.id,
        "#00FF00",
      );

      expect(updated).toBe(true);
      expect(manager.getMarker(marker.id)?.color).toBe("#00FF00");
    });
  });

  describe("export/import", () => {
    it("should export markers to JSON", () => {
      manager.addMarker(100e6, "Marker 1");
      manager.addMarker(200e6, "Marker 2");

      const json = manager.exportMarkers();
      expect(json).toBeTruthy();

      const parsed = JSON.parse(json) as FrequencyMarker[];
      expect(parsed).toHaveLength(2);
    });

    it("should import markers from JSON", () => {
      manager.addMarker(100e6, "Marker 1");
      const json = manager.exportMarkers();

      const newManager = new FrequencyMarkerManager();
      const imported = newManager.importMarkers(json);

      expect(imported).toBe(true);
      expect(newManager.getAllMarkers()).toHaveLength(1);
    });

    it("should handle invalid JSON", () => {
      const imported = manager.importMarkers("invalid json");
      expect(imported).toBe(false);
    });
  });
});
