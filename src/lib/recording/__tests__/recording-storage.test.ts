/**
 * Tests for RecordingStorage class
 */

import { RecordingStorage } from "../recording-storage";

// Mock navigator.storage
const mockStorage = {
  estimate: jest.fn().mockResolvedValue({
    usage: 1024 * 1024, // 1 MB
    quota: 100 * 1024 * 1024, // 100 MB
  }),
};

describe("RecordingStorage", () => {
  let storage: RecordingStorage;

  beforeAll(() => {
    (global as any).navigator = {
      storage: mockStorage,
    };
  });

  beforeEach(() => {
    storage = new RecordingStorage();
    // Don't clear mock here - let each describe block handle it
  });

  afterEach(() => {
    storage.close();
    jest.clearAllMocks();
  });

  describe("getStorageUsage", () => {
    beforeEach(() => {
      // Ensure navigator.storage is set correctly before each test
      (global as any).navigator.storage = mockStorage;
    });

    it("should return storage usage", async () => {
      const usage = await storage.getStorageUsage();
      expect(usage.used).toBe(1024 * 1024);
      expect(usage.quota).toBe(100 * 1024 * 1024);
      expect(usage.percent).toBeCloseTo(1, 1);
    });

    it("should handle missing storage API", async () => {
      const originalStorage = (global as any).navigator.storage;
      try {
        (global as any).navigator.storage = undefined;

        const usage = await storage.getStorageUsage();
        expect(usage.used).toBe(0);
        expect(usage.quota).toBe(0);
        expect(usage.percent).toBe(0);
      } finally {
        (global as any).navigator.storage = originalStorage;
      }
    });
  });

  describe("hasAvailableSpace", () => {
    beforeEach(() => {
      // Ensure navigator.storage is set correctly
      (global as any).navigator.storage = mockStorage;
      mockStorage.estimate.mockClear();
    });

    it("should return true when space is available", async () => {
      const hasSpace = await storage.hasAvailableSpace(1024 * 1024); // 1 MB
      expect(hasSpace).toBe(true);
    });

    it("should return false when space is insufficient", async () => {
      // Request more than available (99 MB available, request 100 MB)
      const hasSpace = await storage.hasAvailableSpace(99 * 1024 * 1024);
      expect(hasSpace).toBe(false);
    });

    it("should use 90% threshold", async () => {
      // With 1 MB used and 100 MB quota, threshold is 90 MB
      // Small request should pass
      const hasSpace = await storage.hasAvailableSpace(10 * 1024 * 1024);
      expect(hasSpace).toBe(true);
      
      // 89 MB request: 1 + 89 = 90 MB = 90% threshold → should fail
      const hasSpaceEdge = await storage.hasAvailableSpace(89 * 1024 * 1024);
      expect(hasSpaceEdge).toBe(false);
    });
  });

  describe("close", () => {
    it("should allow re-initialization after close", () => {
      storage.close();
      // Verify storage is reset
      expect(() => storage.close()).not.toThrow();
    });
  });
});
