/**
 * Tests for diagnostics slice
 */

import { create, type UseBoundStore, type StoreApi } from "zustand";
import { diagnosticsSlice, type DiagnosticsSlice } from "../diagnosticsSlice";

describe("diagnosticsSlice", () => {
  let useStore: UseBoundStore<StoreApi<DiagnosticsSlice>>;

  beforeEach(() => {
    // Create a fresh store for each test
    useStore = create<DiagnosticsSlice>()(diagnosticsSlice);
  });

  it("should initialize with empty state", () => {
    const state = useStore.getState();
    expect(state.events).toEqual([]);
    expect(state.demodulatorMetrics).toBeNull();
    expect(state.tsParserMetrics).toBeNull();
    expect(state.videoDecoderMetrics).toBeNull();
    expect(state.audioDecoderMetrics).toBeNull();
    expect(state.captionDecoderMetrics).toBeNull();
    expect(state.overlayVisible).toBe(false);
  });

  it("should add diagnostic events", () => {
    const { addDiagnosticEvent } = useStore.getState();

    addDiagnosticEvent({
      source: "demodulator",
      severity: "info",
      message: "Test message",
    });

    const state = useStore.getState();
    expect(state.events).toHaveLength(1);
    expect(state.events[0]?.message).toBe("Test message");
    expect(state.events[0]?.source).toBe("demodulator");
    expect(state.events[0]?.severity).toBe("info");
    expect(state.events[0]?.id).toBeDefined();
    expect(state.events[0]?.timestamp).toBeDefined();
  });

  it("should limit events to 100", () => {
    const { addDiagnosticEvent } = useStore.getState();

    // Add 150 events
    for (let i = 0; i < 150; i++) {
      addDiagnosticEvent({
        source: "demodulator",
        severity: "info",
        message: "Message " + i,
      });
    }

    const state = useStore.getState();
    expect(state.events).toHaveLength(100);
    // Should have the last 100 events
    expect(state.events[0]?.message).toBe("Message 50");
    expect(state.events[99]?.message).toBe("Message 149");
  });

  it("should update demodulator metrics", () => {
    const { updateDemodulatorMetrics } = useStore.getState();

    updateDemodulatorMetrics({
      syncLocked: true,
      snr: 15.5,
      mer: 20.3,
      ber: 0.001,
      signalStrength: 0.8,
    });

    const state = useStore.getState();
    expect(state.demodulatorMetrics).toBeDefined();
    expect(state.demodulatorMetrics?.syncLocked).toBe(true);
    expect(state.demodulatorMetrics?.snr).toBe(15.5);
    expect(state.demodulatorMetrics?.mer).toBe(20.3);
    expect(state.demodulatorMetrics?.ber).toBe(0.001);
    expect(state.demodulatorMetrics?.signalStrength).toBe(0.8);
    expect(state.demodulatorMetrics?.timestamp).toBeDefined();
  });

  it("should clear diagnostic events", () => {
    const { addDiagnosticEvent, clearDiagnosticEvents } = useStore.getState();

    // Add some events
    addDiagnosticEvent({
      source: "demodulator",
      severity: "info",
      message: "Test 1",
    });
    addDiagnosticEvent({
      source: "ts-parser",
      severity: "warning",
      message: "Test 2",
    });

    expect(useStore.getState().events).toHaveLength(2);

    clearDiagnosticEvents();

    expect(useStore.getState().events).toHaveLength(0);
  });

  it("should reset all diagnostics", () => {
    const { addDiagnosticEvent, updateDemodulatorMetrics, resetDiagnostics } =
      useStore.getState();

    // Add some data
    addDiagnosticEvent({
      source: "demodulator",
      severity: "info",
      message: "Test",
    });
    updateDemodulatorMetrics({ syncLocked: true, snr: 15 });

    // Verify data exists
    expect(useStore.getState().events).toHaveLength(1);
    expect(useStore.getState().demodulatorMetrics).not.toBeNull();

    // Reset
    resetDiagnostics();

    // Verify all cleared
    const state = useStore.getState();
    expect(state.events).toHaveLength(0);
    expect(state.demodulatorMetrics).toBeNull();
  });

  it("should toggle overlay visibility", () => {
    const { setOverlayVisible } = useStore.getState();

    expect(useStore.getState().overlayVisible).toBe(false);

    setOverlayVisible(true);
    expect(useStore.getState().overlayVisible).toBe(true);

    setOverlayVisible(false);
    expect(useStore.getState().overlayVisible).toBe(false);
  });
});
