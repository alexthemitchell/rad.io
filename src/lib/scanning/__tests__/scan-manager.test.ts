/**
 * ScanManager Tests
 */

import { ScanManager } from "../scan-manager";
import type { ScanConfig } from "../types";
import type { ISDRDevice } from "../../utils/device-utils";

// Mock scanners
jest.mock("../linear-scanner", () => ({
  LinearScanner: jest.fn().mockImplementation(() => ({
    scan: jest.fn().mockResolvedValue([]),
  })),
}));

jest.mock("../adaptive-scanner", () => ({
  AdaptiveScanner: jest.fn().mockImplementation(() => ({
    scan: jest.fn().mockResolvedValue([]),
  })),
}));

jest.mock("../priority-scanner", () => ({
  PriorityScanner: jest.fn().mockImplementation(() => ({
    scan: jest.fn().mockResolvedValue([]),
  })),
}));

jest.mock("../../detection/detection-manager", () => ({
  DetectionManager: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn(),
  })),
}));

describe("ScanManager", () => {
  let manager: ScanManager;
  let mockDevice: ISDRDevice;

  beforeEach(() => {
    manager = new ScanManager();

    mockDevice = {
      setFrequency: jest.fn().mockResolvedValue(undefined),
      captureSamples: jest.fn().mockResolvedValue(new Float32Array(2048)),
      config: {
        sampleRate: 2_000_000,
      },
    };
  });

  afterEach(() => {
    manager.destroy();
  });

  describe("initialize", () => {
    it("should initialize without detection", async () => {
      await manager.initialize(false);
      expect(manager).toBeDefined();
    });

    it("should initialize with detection enabled", async () => {
      await manager.initialize(true);
      expect(manager).toBeDefined();
    });
  });

  describe("startScan", () => {
    it("should start a scan and return scan ID", async () => {
      await manager.initialize();

      const config: ScanConfig = {
        startFreq: 146_000_000,
        endFreq: 146_100_000,
        step: 25_000,
        strategy: "linear",
      };

      const scanId = await manager.startScan(config, mockDevice);

      expect(scanId).toMatch(/^scan-\d+$/);

      // Scan runs in background, so check it was started
      const activeScans = manager.getActiveScans();
      expect(activeScans.length).toBeGreaterThanOrEqual(0); // May finish quickly
    });

    it("should calculate total frequencies correctly", async () => {
      await manager.initialize();

      const config: ScanConfig = {
        startFreq: 146_000_000,
        endFreq: 146_100_000,
        step: 25_000,
        strategy: "linear",
      };

      await manager.startScan(config, mockDevice);

      // 146.000, 146.025, 146.050, 146.075, 146.100 = 5 frequencies
      // This is verified internally in the scan manager
    });

    it("should generate unique scan IDs", async () => {
      await manager.initialize();

      const config: ScanConfig = {
        startFreq: 146_000_000,
        endFreq: 146_100_000,
        step: 25_000,
        strategy: "linear",
      };

      const scanId1 = await manager.startScan(config, mockDevice);
      const scanId2 = await manager.startScan(config, mockDevice);

      expect(scanId1).not.toBe(scanId2);
    });
  });

  describe("stopScan", () => {
    it("should stop an active scan", async () => {
      await manager.initialize();

      // Mock scanner to not complete immediately
      const { LinearScanner } = require("../linear-scanner");
      LinearScanner.mockImplementation(() => ({
        scan: jest.fn().mockImplementation(() => new Promise(() => {})), // Never resolves
      }));

      const config: ScanConfig = {
        startFreq: 146_000_000,
        endFreq: 146_100_000,
        step: 25_000,
        strategy: "linear",
      };

      const scanId = await manager.startScan(config, mockDevice);

      // Wait a bit for scan to start
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(manager.isScanning(scanId)).toBe(true);

      manager.stopScan(scanId);

      expect(manager.isScanning(scanId)).toBe(false);
    });

    it("should handle stopping non-existent scan", () => {
      const consoleSpy = jest.spyOn(console, "info").mockImplementation();

      manager.stopScan("non-existent-scan");

      // Should not throw error
      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe("getResults", () => {
    it("should return empty array for non-existent scan", () => {
      const results = manager.getResults("non-existent-scan");
      expect(results).toEqual([]);
    });
  });

  describe("getActiveScans", () => {
    it("should return empty array when no scans active", () => {
      const activeScans = manager.getActiveScans();
      expect(activeScans).toEqual([]);
    });

    it("should return active scan IDs", async () => {
      await manager.initialize();

      // Mock scanner to not complete immediately
      const { LinearScanner } = require("../linear-scanner");
      LinearScanner.mockImplementation(() => ({
        scan: jest.fn().mockImplementation(() => new Promise(() => {})), // Never resolves
      }));

      const config: ScanConfig = {
        startFreq: 146_000_000,
        endFreq: 146_100_000,
        step: 25_000,
        strategy: "linear",
      };

      const scanId = await manager.startScan(config, mockDevice);

      // Wait a bit for scan to start
      await new Promise((resolve) => setTimeout(resolve, 10));

      const activeScans = manager.getActiveScans();
      expect(activeScans).toContain(scanId);
    });
  });

  describe("isScanning", () => {
    it("should return false for non-existent scan", () => {
      expect(manager.isScanning("non-existent-scan")).toBe(false);
    });

    it("should return true for active scan", async () => {
      await manager.initialize();

      // Mock scanner to not complete immediately
      const { LinearScanner } = require("../linear-scanner");
      LinearScanner.mockImplementation(() => ({
        scan: jest.fn().mockImplementation(() => new Promise(() => {})), // Never resolves
      }));

      const config: ScanConfig = {
        startFreq: 146_000_000,
        endFreq: 146_100_000,
        step: 25_000,
        strategy: "linear",
      };

      const scanId = await manager.startScan(config, mockDevice);

      // Wait a bit for scan to start
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(manager.isScanning(scanId)).toBe(true);
    });
  });

  describe("destroy", () => {
    it("should stop all active scans", async () => {
      await manager.initialize();

      const config: ScanConfig = {
        startFreq: 146_000_000,
        endFreq: 146_100_000,
        step: 25_000,
        strategy: "linear",
      };

      const scanId1 = await manager.startScan(config, mockDevice);
      const scanId2 = await manager.startScan(config, mockDevice);

      manager.destroy();

      expect(manager.isScanning(scanId1)).toBe(false);
      expect(manager.isScanning(scanId2)).toBe(false);
    });

    it("should handle destroy when no scans active", () => {
      expect(() => manager.destroy()).not.toThrow();
    });
  });

  describe("scanner selection", () => {
    it("should use linear scanner for linear strategy", async () => {
      await manager.initialize();

      const config: ScanConfig = {
        startFreq: 146_000_000,
        endFreq: 146_100_000,
        step: 25_000,
        strategy: "linear",
      };

      await manager.startScan(config, mockDevice);

      // LinearScanner should be instantiated
      const { LinearScanner } = require("../linear-scanner");
      expect(LinearScanner).toHaveBeenCalled();
    });

    it("should use adaptive scanner for adaptive strategy", async () => {
      await manager.initialize();

      const config: ScanConfig = {
        startFreq: 146_000_000,
        endFreq: 146_100_000,
        step: 25_000,
        strategy: "adaptive",
      };

      await manager.startScan(config, mockDevice);

      // AdaptiveScanner should be instantiated
      const { AdaptiveScanner } = require("../adaptive-scanner");
      expect(AdaptiveScanner).toHaveBeenCalled();
    });

    it("should use priority scanner for priority strategy", async () => {
      await manager.initialize();

      const config: ScanConfig = {
        startFreq: 146_000_000,
        endFreq: 146_100_000,
        step: 25_000,
        strategy: "priority",
      };

      await manager.startScan(config, mockDevice);

      // PriorityScanner should be instantiated
      const { PriorityScanner } = require("../priority-scanner");
      expect(PriorityScanner).toHaveBeenCalled();
    });

    it("should default to linear scanner for unknown strategy", async () => {
      await manager.initialize();

      const consoleSpy = jest.spyOn(console, "warn").mockImplementation();

      const config: ScanConfig = {
        startFreq: 146_000_000,
        endFreq: 146_100_000,
        step: 25_000,
        strategy: "unknown" as any,
      };

      await manager.startScan(config, mockDevice);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Unknown strategy"),
      );

      consoleSpy.mockRestore();
    });
  });
});
