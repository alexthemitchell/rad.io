/**
 * Tests for VFO slice
 */

import { create, type UseBoundStore, type StoreApi } from "zustand";
import {
  vfoSlice,
  type VfoSlice,
  VfoValidationError,
  validateVfoConfig,
  detectVfoOverlap,
  type VfoValidationContext,
} from "../vfoSlice";
import { VfoStatus, type VfoConfig } from "../../../types/vfo";

describe("vfoSlice", () => {
  let useStore: UseBoundStore<StoreApi<VfoSlice>>;

  // Common validation context for tests
  const defaultValidationContext = {
    hardwareCenterHz: 100_000_000, // 100 MHz
    sampleRateHz: 20_000_000, // 20 MS/s (20 MHz bandwidth)
  };

  beforeEach(() => {
    // Create a fresh store for each test
    useStore = create<VfoSlice>()(vfoSlice);
  });

  describe("initialization", () => {
    it("should initialize with empty VFO map", () => {
      const state = useStore.getState();
      expect(state.vfos.size).toBe(0);
      expect(state.getAllVfos()).toEqual([]);
    });

    it("should initialize with default maxVfos of 8", () => {
      const state = useStore.getState();
      expect(state.maxVfos).toBe(8);
    });
  });

  describe("addVfo", () => {
    it("should add a VFO successfully", () => {
      const { addVfo, getAllVfos } = useStore.getState();

      const vfoConfig: VfoConfig = {
        id: "vfo-1",
        centerHz: 100_000_000,
        modeId: "wbfm",
        bandwidthHz: 200_000,
        audioEnabled: true,
      };

      addVfo(vfoConfig, defaultValidationContext);

      const vfos = getAllVfos();
      expect(vfos).toHaveLength(1);
      expect(vfos[0]).toMatchObject({
        id: "vfo-1",
        centerHz: 100_000_000,
        modeId: "wbfm",
        bandwidthHz: 200_000,
        audioEnabled: true,
        status: VfoStatus.IDLE,
        demodulator: null,
        audioNode: null,
      });
      expect(vfos[0]?.audioGain).toBe(1.0); // default
      expect(vfos[0]?.priority).toBe(5); // default
      expect(vfos[0]?.createdAt).toBeDefined();
      expect(vfos[0]?.metrics).toMatchObject({
        rssi: -100,
        samplesProcessed: 0,
        processingTime: 0,
      });
    });

    it("should add multiple VFOs", () => {
      const { addVfo, getAllVfos } = useStore.getState();

      addVfo(
        {
          id: "vfo-1",
          centerHz: 95_000_000,
          modeId: "wbfm",
          bandwidthHz: 200_000,
          audioEnabled: true,
        },
        defaultValidationContext,
      );

      addVfo(
        {
          id: "vfo-2",
          centerHz: 100_000_000,
          modeId: "am",
          bandwidthHz: 10_000,
          audioEnabled: false,
        },
        defaultValidationContext,
      );

      const vfos = getAllVfos();
      expect(vfos).toHaveLength(2);
      expect(vfos[0]?.id).toBe("vfo-1");
      expect(vfos[1]?.id).toBe("vfo-2");
    });

    it("should reject VFO when max count exceeded", () => {
      const { addVfo, setMaxVfos } = useStore.getState();

      setMaxVfos(2);

      addVfo(
        {
          id: "vfo-1",
          centerHz: 95_000_000,
          modeId: "wbfm",
          bandwidthHz: 200_000,
          audioEnabled: true,
        },
        defaultValidationContext,
      );

      addVfo(
        {
          id: "vfo-2",
          centerHz: 100_000_000,
          modeId: "am",
          bandwidthHz: 10_000,
          audioEnabled: true,
        },
        defaultValidationContext,
      );

      // Third VFO should fail
      expect(() => {
        addVfo(
          {
            id: "vfo-3",
            centerHz: 105_000_000,
            modeId: "nbfm",
            bandwidthHz: 12_500,
            audioEnabled: true,
          },
          defaultValidationContext,
        );
      }).toThrow(VfoValidationError);
      expect(() => {
        addVfo(
          {
            id: "vfo-3",
            centerHz: 105_000_000,
            modeId: "nbfm",
            bandwidthHz: 12_500,
            audioEnabled: true,
          },
          defaultValidationContext,
        );
      }).toThrow("Maximum VFO count (2) reached");
    });

    it("should reject VFO outside hardware bandwidth (center too low)", () => {
      const { addVfo } = useStore.getState();

      expect(() => {
        addVfo(
          {
            id: "vfo-1",
            centerHz: 85_000_000, // Below 90 MHz lower edge
            modeId: "wbfm",
            bandwidthHz: 200_000,
            audioEnabled: true,
          },
          defaultValidationContext,
        );
      }).toThrow(VfoValidationError);
      expect(() => {
        addVfo(
          {
            id: "vfo-1",
            centerHz: 85_000_000,
            modeId: "wbfm",
            bandwidthHz: 200_000,
            audioEnabled: true,
          },
          defaultValidationContext,
        );
      }).toThrow("outside hardware capture range");
    });

    it("should reject VFO outside hardware bandwidth (center too high)", () => {
      const { addVfo } = useStore.getState();

      expect(() => {
        addVfo(
          {
            id: "vfo-1",
            centerHz: 115_000_000, // Above 110 MHz upper edge
            modeId: "wbfm",
            bandwidthHz: 200_000,
            audioEnabled: true,
          },
          defaultValidationContext,
        );
      }).toThrow(VfoValidationError);
      expect(() => {
        addVfo(
          {
            id: "vfo-1",
            centerHz: 115_000_000,
            modeId: "wbfm",
            bandwidthHz: 200_000,
            audioEnabled: true,
          },
          defaultValidationContext,
        );
      }).toThrow("outside hardware capture range");
    });

    it("should reject VFO when bandwidth exceeds hardware range (low edge)", () => {
      const { addVfo } = useStore.getState();

      expect(() => {
        addVfo(
          {
            id: "vfo-1",
            centerHz: 90_500_000, // Center at 90.5 MHz
            modeId: "wbfm",
            bandwidthHz: 2_000_000, // 2 MHz bandwidth (edges: 89.5-91.5 MHz)
            audioEnabled: true,
          },
          defaultValidationContext,
        );
      }).toThrow(VfoValidationError);
      expect(() => {
        addVfo(
          {
            id: "vfo-1",
            centerHz: 90_500_000,
            modeId: "wbfm",
            bandwidthHz: 2_000_000,
            audioEnabled: true,
          },
          defaultValidationContext,
        );
      }).toThrow("exceeds hardware capture range");
    });

    it("should reject VFO when bandwidth exceeds hardware range (high edge)", () => {
      const { addVfo } = useStore.getState();

      expect(() => {
        addVfo(
          {
            id: "vfo-1",
            centerHz: 109_500_000, // Center at 109.5 MHz
            modeId: "wbfm",
            bandwidthHz: 2_000_000, // 2 MHz bandwidth (edges: 108.5-110.5 MHz)
            audioEnabled: true,
          },
          defaultValidationContext,
        );
      }).toThrow(VfoValidationError);
      expect(() => {
        addVfo(
          {
            id: "vfo-1",
            centerHz: 109_500_000,
            modeId: "wbfm",
            bandwidthHz: 2_000_000,
            audioEnabled: true,
          },
          defaultValidationContext,
        );
      }).toThrow("exceeds hardware capture range");
    });

    it("should reject VFO with negative center frequency", () => {
      const { addVfo } = useStore.getState();

      expect(() => {
        addVfo(
          {
            id: "vfo-1",
            centerHz: -100_000,
            modeId: "am",
            bandwidthHz: 10_000,
            audioEnabled: true,
          },
          defaultValidationContext,
        );
      }).toThrow(VfoValidationError);
      expect(() => {
        addVfo(
          {
            id: "vfo-1",
            centerHz: -100_000,
            modeId: "am",
            bandwidthHz: 10_000,
            audioEnabled: true,
          },
          defaultValidationContext,
        );
      }).toThrow("must be >= 0");
    });

    it("should warn about VFO spacing violations (console.warn)", () => {
      const { addVfo } = useStore.getState();
      const warnSpy = jest.spyOn(console, "warn").mockImplementation();

      // Add first VFO at 100 MHz
      addVfo(
        {
          id: "vfo-1",
          centerHz: 100_000_000,
          modeId: "wbfm",
          bandwidthHz: 200_000,
          audioEnabled: true,
        },
        defaultValidationContext,
      );

      // Add second VFO too close (100.1 MHz, only 100 kHz spacing)
      // WBFM requires 200 kHz minimum spacing
      addVfo(
        {
          id: "vfo-2",
          centerHz: 100_100_000,
          modeId: "wbfm",
          bandwidthHz: 200_000,
          audioEnabled: true,
        },
        defaultValidationContext,
      );

      // Should have warned about spacing
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("VFO spacing warning"),
      );

      warnSpy.mockRestore();
    });

    it("should preserve custom audioGain and priority", () => {
      const { addVfo, getVfo } = useStore.getState();

      addVfo(
        {
          id: "vfo-1",
          centerHz: 100_000_000,
          modeId: "am",
          bandwidthHz: 10_000,
          audioEnabled: true,
          audioGain: 0.5,
          priority: 8,
        },
        defaultValidationContext,
      );

      const vfo = getVfo("vfo-1");
      expect(vfo?.audioGain).toBe(0.5);
      expect(vfo?.priority).toBe(8);
    });
  });

  describe("removeVfo", () => {
    it("should remove a VFO by ID", () => {
      const { addVfo, removeVfo, getAllVfos } = useStore.getState();

      addVfo(
        {
          id: "vfo-1",
          centerHz: 95_000_000,
          modeId: "wbfm",
          bandwidthHz: 200_000,
          audioEnabled: true,
        },
        defaultValidationContext,
      );

      addVfo(
        {
          id: "vfo-2",
          centerHz: 100_000_000,
          modeId: "am",
          bandwidthHz: 10_000,
          audioEnabled: true,
        },
        defaultValidationContext,
      );

      expect(getAllVfos()).toHaveLength(2);

      removeVfo("vfo-1");

      const vfos = getAllVfos();
      expect(vfos).toHaveLength(1);
      expect(vfos[0]?.id).toBe("vfo-2");
    });

    it("should handle removing non-existent VFO gracefully", () => {
      const { removeVfo, getAllVfos } = useStore.getState();
      const warnSpy = jest.spyOn(console, "warn").mockImplementation();

      removeVfo("non-existent");

      expect(getAllVfos()).toHaveLength(0);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("non-existent VFO"),
      );

      warnSpy.mockRestore();
    });
  });

  describe("updateVfo", () => {
    it("should update VFO configuration", () => {
      const { addVfo, updateVfo, getVfo } = useStore.getState();

      addVfo(
        {
          id: "vfo-1",
          centerHz: 100_000_000,
          modeId: "wbfm",
          bandwidthHz: 200_000,
          audioEnabled: true,
        },
        defaultValidationContext,
      );

      updateVfo(
        "vfo-1",
        {
          centerHz: 101_000_000,
          label: "Updated VFO",
        },
        defaultValidationContext,
      );

      const vfo = getVfo("vfo-1");
      expect(vfo?.centerHz).toBe(101_000_000);
      expect(vfo?.label).toBe("Updated VFO");
      expect(vfo?.modeId).toBe("wbfm"); // unchanged
    });

    it("should validate updated configuration", () => {
      const { addVfo, updateVfo } = useStore.getState();

      addVfo(
        {
          id: "vfo-1",
          centerHz: 100_000_000,
          modeId: "wbfm",
          bandwidthHz: 200_000,
          audioEnabled: true,
        },
        defaultValidationContext,
      );

      // Try to update to invalid frequency
      expect(() => {
        updateVfo(
          "vfo-1",
          {
            centerHz: 120_000_000, // Outside range
          },
          defaultValidationContext,
        );
      }).toThrow(VfoValidationError);
    });

    it("should handle updating non-existent VFO gracefully", () => {
      const { updateVfo } = useStore.getState();
      const warnSpy = jest.spyOn(console, "warn").mockImplementation();

      updateVfo(
        "non-existent",
        { centerHz: 100_000_000 },
        defaultValidationContext,
      );

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("non-existent VFO"),
      );

      warnSpy.mockRestore();
    });
  });

  describe("updateVfoState", () => {
    it("should update VFO runtime state without validation", () => {
      const { addVfo, updateVfoState, getVfo } = useStore.getState();

      addVfo(
        {
          id: "vfo-1",
          centerHz: 100_000_000,
          modeId: "wbfm",
          bandwidthHz: 200_000,
          audioEnabled: true,
        },
        defaultValidationContext,
      );

      updateVfoState("vfo-1", {
        status: VfoStatus.ACTIVE,
        metrics: {
          rssi: -50,
          snr: 30,
          samplesProcessed: 1024,
          processingTime: 5.2,
          timestamp: Date.now(),
        },
      });

      const vfo = getVfo("vfo-1");
      expect(vfo?.status).toBe(VfoStatus.ACTIVE);
      expect(vfo?.metrics.rssi).toBe(-50);
      expect(vfo?.metrics.snr).toBe(30);
    });

    it("should handle updating non-existent VFO state gracefully", () => {
      const { updateVfoState } = useStore.getState();
      const warnSpy = jest.spyOn(console, "warn").mockImplementation();

      updateVfoState("non-existent", { status: VfoStatus.ACTIVE });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("non-existent VFO"),
      );

      warnSpy.mockRestore();
    });
  });

  describe("setVfoAudio", () => {
    it("should toggle VFO audio on/off", () => {
      const { addVfo, setVfoAudio, getVfo } = useStore.getState();

      addVfo(
        {
          id: "vfo-1",
          centerHz: 100_000_000,
          modeId: "wbfm",
          bandwidthHz: 200_000,
          audioEnabled: true,
        },
        defaultValidationContext,
      );

      setVfoAudio("vfo-1", false);
      expect(getVfo("vfo-1")?.audioEnabled).toBe(false);

      setVfoAudio("vfo-1", true);
      expect(getVfo("vfo-1")?.audioEnabled).toBe(true);
    });

    it("should handle setting audio for non-existent VFO gracefully", () => {
      const { setVfoAudio } = useStore.getState();
      const warnSpy = jest.spyOn(console, "warn").mockImplementation();

      setVfoAudio("non-existent", true);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("non-existent VFO"),
      );

      warnSpy.mockRestore();
    });
  });

  describe("clearVfos", () => {
    it("should remove all VFOs", () => {
      const { addVfo, clearVfos, getAllVfos } = useStore.getState();

      addVfo(
        {
          id: "vfo-1",
          centerHz: 95_000_000,
          modeId: "wbfm",
          bandwidthHz: 200_000,
          audioEnabled: true,
        },
        defaultValidationContext,
      );

      addVfo(
        {
          id: "vfo-2",
          centerHz: 100_000_000,
          modeId: "am",
          bandwidthHz: 10_000,
          audioEnabled: true,
        },
        defaultValidationContext,
      );

      expect(getAllVfos()).toHaveLength(2);

      clearVfos();

      expect(getAllVfos()).toHaveLength(0);
      expect(useStore.getState().vfos.size).toBe(0);
    });
  });

  describe("getVfo", () => {
    it("should get VFO by ID", () => {
      const { addVfo, getVfo } = useStore.getState();

      addVfo(
        {
          id: "vfo-1",
          centerHz: 100_000_000,
          modeId: "wbfm",
          bandwidthHz: 200_000,
          audioEnabled: true,
        },
        defaultValidationContext,
      );

      const vfo = getVfo("vfo-1");
      expect(vfo).toBeDefined();
      expect(vfo?.id).toBe("vfo-1");
      expect(vfo?.centerHz).toBe(100_000_000);
    });

    it("should return undefined for non-existent VFO", () => {
      const { getVfo } = useStore.getState();
      expect(getVfo("non-existent")).toBeUndefined();
    });
  });

  describe("getAllVfos", () => {
    it("should return all VFOs as array", () => {
      const { addVfo, getAllVfos } = useStore.getState();

      addVfo(
        {
          id: "vfo-1",
          centerHz: 95_000_000,
          modeId: "wbfm",
          bandwidthHz: 200_000,
          audioEnabled: true,
        },
        defaultValidationContext,
      );

      addVfo(
        {
          id: "vfo-2",
          centerHz: 100_000_000,
          modeId: "am",
          bandwidthHz: 10_000,
          audioEnabled: true,
        },
        defaultValidationContext,
      );

      const vfos = getAllVfos();
      expect(vfos).toHaveLength(2);
      expect(vfos.map((v) => v.id)).toEqual(["vfo-1", "vfo-2"]);
    });

    it("should return empty array when no VFOs", () => {
      const { getAllVfos } = useStore.getState();
      expect(getAllVfos()).toEqual([]);
    });
  });

  describe("getActiveVfos", () => {
    it("should return only active VFOs", () => {
      const { addVfo, updateVfoState, getActiveVfos } = useStore.getState();

      addVfo(
        {
          id: "vfo-1",
          centerHz: 95_000_000,
          modeId: "wbfm",
          bandwidthHz: 200_000,
          audioEnabled: true,
        },
        defaultValidationContext,
      );

      addVfo(
        {
          id: "vfo-2",
          centerHz: 100_000_000,
          modeId: "am",
          bandwidthHz: 10_000,
          audioEnabled: true,
        },
        defaultValidationContext,
      );

      addVfo(
        {
          id: "vfo-3",
          centerHz: 105_000_000,
          modeId: "nbfm",
          bandwidthHz: 12_500,
          audioEnabled: true,
        },
        defaultValidationContext,
      );

      // Set vfo-1 and vfo-3 to ACTIVE
      updateVfoState("vfo-1", { status: VfoStatus.ACTIVE });
      updateVfoState("vfo-3", { status: VfoStatus.ACTIVE });
      // vfo-2 remains IDLE

      const activeVfos = getActiveVfos();
      expect(activeVfos).toHaveLength(2);
      expect(activeVfos.map((v) => v.id).sort()).toEqual(["vfo-1", "vfo-3"]);
    });

    it("should return empty array when no active VFOs", () => {
      const { addVfo, getActiveVfos } = useStore.getState();

      addVfo(
        {
          id: "vfo-1",
          centerHz: 100_000_000,
          modeId: "wbfm",
          bandwidthHz: 200_000,
          audioEnabled: true,
        },
        defaultValidationContext,
      );

      // VFO is IDLE by default
      expect(getActiveVfos()).toEqual([]);
    });
  });

  describe("setMaxVfos", () => {
    it("should update max VFO count", () => {
      const { setMaxVfos } = useStore.getState();

      setMaxVfos(16);
      expect(useStore.getState().maxVfos).toBe(16);
    });

    it("should reject invalid max VFO count", () => {
      const { setMaxVfos } = useStore.getState();
      const warnSpy = jest.spyOn(console, "warn").mockImplementation();

      setMaxVfos(0);
      expect(useStore.getState().maxVfos).toBe(8); // unchanged

      setMaxVfos(-1);
      expect(useStore.getState().maxVfos).toBe(8); // unchanged

      expect(warnSpy).toHaveBeenCalledTimes(2);

      warnSpy.mockRestore();
    });
  });

  describe("validateVfoConfig", () => {
    const baseContext: VfoValidationContext = {
      hardwareCenterHz: 100_000_000,
      sampleRateHz: 20_000_000,
      existingVfos: [],
      maxVfos: 8,
    };

    it("should pass validation for valid config", () => {
      const config: VfoConfig = {
        id: "vfo-1",
        centerHz: 100_000_000,
        modeId: "wbfm",
        bandwidthHz: 200_000,
        audioEnabled: true,
      };

      expect(() => {
        validateVfoConfig(config, baseContext);
      }).not.toThrow();
    });

    it("should reject when max VFOs reached", () => {
      const context = { ...baseContext, maxVfos: 0 };
      const config: VfoConfig = {
        id: "vfo-1",
        centerHz: 100_000_000,
        modeId: "wbfm",
        bandwidthHz: 200_000,
        audioEnabled: true,
      };

      expect(() => {
        validateVfoConfig(config, context);
      }).toThrow(VfoValidationError);
    });

    it("should reject negative center frequency", () => {
      const config: VfoConfig = {
        id: "vfo-1",
        centerHz: -1000,
        modeId: "am",
        bandwidthHz: 10_000,
        audioEnabled: true,
      };

      expect(() => {
        validateVfoConfig(config, baseContext);
      }).toThrow(VfoValidationError);
    });
  });

  describe("detectVfoOverlap", () => {
    it("should detect overlapping VFOs", () => {
      const vfo1: VfoConfig = {
        id: "vfo-1",
        centerHz: 100_000_000,
        modeId: "wbfm",
        bandwidthHz: 200_000,
        audioEnabled: true,
      };

      const vfo2: VfoConfig = {
        id: "vfo-2",
        centerHz: 100_100_000,
        modeId: "wbfm",
        bandwidthHz: 200_000,
        audioEnabled: true,
      };

      expect(detectVfoOverlap(vfo1, vfo2)).toBe(true);
    });

    it("should detect non-overlapping VFOs", () => {
      const vfo1: VfoConfig = {
        id: "vfo-1",
        centerHz: 100_000_000,
        modeId: "wbfm",
        bandwidthHz: 200_000,
        audioEnabled: true,
      };

      const vfo2: VfoConfig = {
        id: "vfo-2",
        centerHz: 105_000_000,
        modeId: "wbfm",
        bandwidthHz: 200_000,
        audioEnabled: true,
      };

      expect(detectVfoOverlap(vfo1, vfo2)).toBe(false);
    });

    it("should detect edge-adjacent VFOs as non-overlapping", () => {
      const vfo1: VfoConfig = {
        id: "vfo-1",
        centerHz: 100_000_000,
        modeId: "wbfm",
        bandwidthHz: 200_000,
        audioEnabled: true,
      };

      const vfo2: VfoConfig = {
        id: "vfo-2",
        centerHz: 100_200_000, // Exactly 200kHz away
        modeId: "wbfm",
        bandwidthHz: 200_000,
        audioEnabled: true,
      };

      // Edges touch but don't overlap
      expect(detectVfoOverlap(vfo1, vfo2)).toBe(false);
    });
  });
});
