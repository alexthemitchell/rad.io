/**
 * Tests for Zustand store
 */

import { useStore } from "../index";

describe("Zustand Store", () => {
  beforeEach(() => {
    // Reset store before each test
    const state = useStore.getState();
    state.resetSettings();
    state.setFrequencyHz(100_000_000);
    // Clear notifications
    state.notifications.forEach(() => {
      // Notifications will auto-clear, just reset the array
    });
    // Reset to empty state
    useStore.setState({ notifications: [], _nextId: 0, _timeouts: new Map() });
  });

  describe("Settings Slice", () => {
    it("should have default settings", () => {
      const { settings } = useStore.getState();
      expect(settings.highPerf).toBe(false);
      expect(settings.vizMode).toBe("fft");
      expect(settings.showWaterfall).toBe(true);
      expect(settings.fftSize).toBe(4096);
      expect(settings.colorMap).toBe("turbo");
    });

    it("should update settings partially", () => {
      const { setSettings } = useStore.getState();
      setSettings({ highPerf: true });
      const { settings } = useStore.getState();
      expect(settings.highPerf).toBe(true);
      expect(settings.vizMode).toBe("fft"); // Other settings unchanged
    });

    it("should reset settings to defaults", () => {
      const { setSettings, resetSettings } = useStore.getState();
      setSettings({ highPerf: true, fftSize: 8192 });
      resetSettings();
      const { settings } = useStore.getState();
      expect(settings.highPerf).toBe(false);
      expect(settings.fftSize).toBe(4096);
    });

    it("should validate fftSize", () => {
      const { setSettings } = useStore.getState();
      const initialFftSize = useStore.getState().settings.fftSize;
      // @ts-expect-error Testing invalid fftSize
      setSettings({ fftSize: 1000 });
      const { settings } = useStore.getState();
      expect(settings.fftSize).toBe(initialFftSize); // Should not change
    });

    it("should normalize dB range", () => {
      const { setSettings } = useStore.getState();
      setSettings({ dbMin: -80, dbMax: -20 });
      const { settings } = useStore.getState();
      expect(settings.dbMin).toBe(-80);
      expect(settings.dbMax).toBe(-20);
    });

    it("should reject invalid dB range", () => {
      const { setSettings } = useStore.getState();
      setSettings({ dbMin: -20, dbMax: -80 }); // Invalid: min > max
      const { settings } = useStore.getState();
      expect(settings.dbMin).toBeUndefined();
      expect(settings.dbMax).toBeUndefined();
    });
  });

  describe("Frequency Slice", () => {
    it("should have default frequency", () => {
      const { frequencyHz } = useStore.getState();
      expect(frequencyHz).toBe(100_000_000); // 100 MHz
    });

    it("should update frequency", () => {
      const { setFrequencyHz } = useStore.getState();
      setFrequencyHz(88_500_000); // 88.5 MHz (FM radio)
      const { frequencyHz } = useStore.getState();
      expect(frequencyHz).toBe(88_500_000);
    });
  });

  describe("Notification Slice", () => {
    it("should start with no notifications", () => {
      const { notifications } = useStore.getState();
      expect(notifications).toHaveLength(0);
    });

    it("should add notifications", () => {
      const { notify } = useStore.getState();
      notify({
        message: "Test notification",
        tone: "info",
        sr: "polite",
        visual: true,
      });
      const { notifications } = useStore.getState();
      expect(notifications).toHaveLength(1);
      expect(notifications[0].message).toBe("Test notification");
    });

    it("should auto-remove notifications after duration", (done) => {
      const { notify } = useStore.getState();
      notify({
        message: "Test notification",
        tone: "info",
        sr: "polite",
        visual: true,
        duration: 100, // 100ms for testing
      });
      expect(useStore.getState().notifications).toHaveLength(1);

      setTimeout(() => {
        const { notifications } = useStore.getState();
        expect(notifications).toHaveLength(0);
        done();
      }, 150);
    });
  });

  describe("Device Slice", () => {
    it("should start with no devices", () => {
      const { devices, primaryDevice } = useStore.getState();
      expect(devices.size).toBe(0);
      expect(primaryDevice).toBeUndefined();
    });

    it("should track isCheckingPaired state", () => {
      const { setIsCheckingPaired } = useStore.getState();
      setIsCheckingPaired(true);
      expect(useStore.getState().isCheckingPaired).toBe(true);
      setIsCheckingPaired(false);
      expect(useStore.getState().isCheckingPaired).toBe(false);
    });
  });

  describe("Store Integration", () => {
    it("should allow reading multiple slices", () => {
      const state = useStore.getState();
      expect(state.settings).toBeDefined();
      expect(state.frequencyHz).toBeDefined();
      expect(state.notifications).toBeDefined();
      expect(state.devices).toBeDefined();
    });

    it("should maintain independent slice state", () => {
      const { setSettings, setFrequencyHz } = useStore.getState();
      setSettings({ highPerf: true });
      setFrequencyHz(915_000_000);

      const state = useStore.getState();
      expect(state.settings.highPerf).toBe(true);
      expect(state.frequencyHz).toBe(915_000_000);
    });
  });
});
