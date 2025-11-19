/**
 * Tests for marker slice
 */

import { create, type UseBoundStore, type StoreApi } from "zustand";
import { markerSlice, type MarkerSlice } from "../markerSlice";

describe("markerSlice", () => {
  let useStore: UseBoundStore<StoreApi<MarkerSlice>>;

  beforeEach(() => {
    // Create a fresh store for each test
    useStore = create<MarkerSlice>()(markerSlice);
  });

  it("should initialize with empty markers array", () => {
    const state = useStore.getState();
    expect(state.markers).toEqual([]);
  });

  it("should add a marker with auto-generated label M1", () => {
    const { addMarker } = useStore.getState();

    addMarker(100e6, -50);

    const state = useStore.getState();
    expect(state.markers).toHaveLength(1);
    expect(state.markers[0]).toMatchObject({
      label: "M1",
      freqHz: 100e6,
      powerDb: -50,
    });
    expect(state.markers[0]?.id).toBeDefined();
  });

  it("should add multiple markers with sequential labels", () => {
    const { addMarker } = useStore.getState();

    addMarker(100e6, -50);
    addMarker(200e6, -40);
    addMarker(300e6, -30);

    const state = useStore.getState();
    expect(state.markers).toHaveLength(3);
    expect(state.markers[0]?.label).toBe("M1");
    expect(state.markers[1]?.label).toBe("M2");
    expect(state.markers[2]?.label).toBe("M3");
  });

  it("should add marker without powerDb", () => {
    const { addMarker } = useStore.getState();

    addMarker(100e6);

    const state = useStore.getState();
    expect(state.markers).toHaveLength(1);
    expect(state.markers[0]).toMatchObject({
      label: "M1",
      freqHz: 100e6,
    });
    expect(state.markers[0]?.powerDb).toBeUndefined();
  });

  it("should remove a marker by id", () => {
    const { addMarker, removeMarker } = useStore.getState();

    addMarker(100e6, -50);
    addMarker(200e6, -40);

    const state = useStore.getState();
    const markerIdToRemove = state.markers[0]?.id ?? "";

    removeMarker(markerIdToRemove);

    const newState = useStore.getState();
    expect(newState.markers).toHaveLength(1);
    expect(newState.markers[0]?.freqHz).toBe(200e6);
  });

  it("should not fail when removing non-existent marker", () => {
    const { addMarker, removeMarker } = useStore.getState();

    addMarker(100e6, -50);

    removeMarker("non-existent-id");

    const state = useStore.getState();
    expect(state.markers).toHaveLength(1);
  });

  it("should clear all markers", () => {
    const { addMarker, clearMarkers } = useStore.getState();

    addMarker(100e6, -50);
    addMarker(200e6, -40);
    addMarker(300e6, -30);

    clearMarkers();

    const state = useStore.getState();
    expect(state.markers).toEqual([]);
  });

  it("should generate unique IDs for each marker", () => {
    const { addMarker } = useStore.getState();

    addMarker(100e6, -50);
    addMarker(200e6, -40);
    addMarker(300e6, -30);

    const state = useStore.getState();
    const ids = state.markers.map((m) => m.id);
    const uniqueIds = new Set(ids);

    expect(uniqueIds.size).toBe(3);
  });

  it("should preserve marker order", () => {
    const { addMarker } = useStore.getState();

    addMarker(100e6, -50);
    addMarker(200e6, -40);
    addMarker(300e6, -30);

    const state = useStore.getState();
    expect(state.markers[0]?.freqHz).toBe(100e6);
    expect(state.markers[1]?.freqHz).toBe(200e6);
    expect(state.markers[2]?.freqHz).toBe(300e6);
  });

  it("should continue sequential labeling after removal", () => {
    const { addMarker, removeMarker } = useStore.getState();

    addMarker(100e6, -50); // M1
    addMarker(200e6, -40); // M2

    const state = useStore.getState();
    const marker1Id = state.markers[0]?.id ?? "";

    removeMarker(marker1Id);

    addMarker(300e6, -30); // Should be M2 (based on current length + 1)

    const newState = useStore.getState();
    expect(newState.markers).toHaveLength(2);
    expect(newState.markers[0]?.label).toBe("M2");
    expect(newState.markers[1]?.label).toBe("M2");
  });
});
