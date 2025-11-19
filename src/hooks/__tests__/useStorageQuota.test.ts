import { renderHook, waitFor } from "@testing-library/react";
import { useStorageQuota } from "../useStorageQuota";

// Mock StorageManager API
interface StorageEstimate {
  usage?: number;
  quota?: number;
}

interface MockNavigatorStorage {
  estimate: () => Promise<StorageEstimate>;
}

const mockEstimate = jest.fn<Promise<StorageEstimate>, []>();

describe("useStorageQuota", () => {
  let originalNavigator: typeof navigator;

  beforeEach(() => {
    originalNavigator = global.navigator;
    mockEstimate.mockClear();
  });

  afterEach(() => {
    Object.defineProperty(global, "navigator", {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
    jest.clearAllTimers();
  });

  it("should detect unsupported browsers", () => {
    // Mock browser without storage API
    Object.defineProperty(global, "navigator", {
      value: {},
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useStorageQuota());

    expect(result.current.supported).toBe(false);
    expect(result.current.usage).toBe(0);
    expect(result.current.quota).toBe(0);
    expect(result.current.percentUsed).toBe(0);
    expect(result.current.available).toBe(0);
  });

  it("should fetch storage quota on mount", async () => {
    mockEstimate.mockResolvedValue({
      usage: 50 * 1024 * 1024, // 50 MB
      quota: 100 * 1024 * 1024, // 100 MB
    });

    Object.defineProperty(global, "navigator", {
      value: {
        storage: {
          estimate: mockEstimate,
        } as MockNavigatorStorage,
      },
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useStorageQuota());

    await waitFor(() => {
      expect(result.current.usage).toBe(50 * 1024 * 1024);
    });

    expect(result.current.supported).toBe(true);
    expect(result.current.quota).toBe(100 * 1024 * 1024);
    expect(result.current.percentUsed).toBe(50);
    expect(result.current.available).toBe(50 * 1024 * 1024);
    expect(mockEstimate).toHaveBeenCalledTimes(1);
  });

  it("should calculate percentUsed correctly", async () => {
    mockEstimate.mockResolvedValue({
      usage: 85 * 1024 * 1024, // 85 MB
      quota: 100 * 1024 * 1024, // 100 MB
    });

    Object.defineProperty(global, "navigator", {
      value: {
        storage: {
          estimate: mockEstimate,
        } as MockNavigatorStorage,
      },
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useStorageQuota());

    await waitFor(() => {
      expect(result.current.percentUsed).toBe(85);
    });
  });

  it("should handle missing usage/quota gracefully", async () => {
    mockEstimate.mockResolvedValue({});

    Object.defineProperty(global, "navigator", {
      value: {
        storage: {
          estimate: mockEstimate,
        } as MockNavigatorStorage,
      },
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useStorageQuota());

    await waitFor(() => {
      expect(result.current.supported).toBe(true);
    });

    expect(result.current.usage).toBe(0);
    expect(result.current.quota).toBe(0);
    expect(result.current.percentUsed).toBe(0);
    expect(result.current.available).toBe(0);
  });

  it("should handle estimate() errors gracefully", async () => {
    mockEstimate.mockRejectedValue(new Error("Storage API error"));

    Object.defineProperty(global, "navigator", {
      value: {
        storage: {
          estimate: mockEstimate,
        } as MockNavigatorStorage,
      },
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useStorageQuota());

    await waitFor(() => {
      expect(result.current.supported).toBe(false);
    });
  });

  it("should poll storage every 10 seconds", async () => {
    jest.useFakeTimers();

    mockEstimate.mockResolvedValue({
      usage: 10 * 1024 * 1024,
      quota: 100 * 1024 * 1024,
    });

    Object.defineProperty(global, "navigator", {
      value: {
        storage: {
          estimate: mockEstimate,
        } as MockNavigatorStorage,
      },
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useStorageQuota());

    await waitFor(() => {
      expect(result.current.supported).toBe(true);
    });

    expect(mockEstimate).toHaveBeenCalledTimes(1);

    // Fast-forward 10 seconds
    jest.advanceTimersByTime(10000);

    await waitFor(() => {
      expect(mockEstimate).toHaveBeenCalledTimes(2);
    });

    // Fast-forward another 10 seconds
    jest.advanceTimersByTime(10000);

    await waitFor(() => {
      expect(mockEstimate).toHaveBeenCalledTimes(3);
    });

    jest.useRealTimers();
  });

  it("should cleanup interval on unmount", async () => {
    jest.useFakeTimers();

    mockEstimate.mockResolvedValue({
      usage: 10 * 1024 * 1024,
      quota: 100 * 1024 * 1024,
    });

    Object.defineProperty(global, "navigator", {
      value: {
        storage: {
          estimate: mockEstimate,
        } as MockNavigatorStorage,
      },
      writable: true,
      configurable: true,
    });

    const { unmount } = renderHook(() => useStorageQuota());

    await waitFor(() => {
      expect(mockEstimate).toHaveBeenCalledTimes(1);
    });

    unmount();

    // Fast-forward time after unmount
    jest.advanceTimersByTime(20000);

    // Should not call estimate again after unmount
    expect(mockEstimate).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
  });

  it("should handle zero quota edge case", async () => {
    mockEstimate.mockResolvedValue({
      usage: 0,
      quota: 0,
    });

    Object.defineProperty(global, "navigator", {
      value: {
        storage: {
          estimate: mockEstimate,
        } as MockNavigatorStorage,
      },
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useStorageQuota());

    await waitFor(() => {
      expect(result.current.supported).toBe(true);
    });

    expect(result.current.percentUsed).toBe(0);
    expect(result.current.available).toBe(0);
  });

  it("should handle usage exceeding quota (never show negative available)", async () => {
    // Edge case: usage reported as higher than quota
    mockEstimate.mockResolvedValue({
      usage: 110 * 1024 * 1024 * 1024, // 110 GB
      quota: 100 * 1024 * 1024 * 1024, // 100 GB
    });

    Object.defineProperty(global, "navigator", {
      value: {
        storage: {
          estimate: mockEstimate,
        } as MockNavigatorStorage,
      },
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useStorageQuota());

    await waitFor(() => {
      expect(result.current.usage).toBe(110 * 1024 * 1024 * 1024);
    });

    expect(result.current.quota).toBe(100 * 1024 * 1024 * 1024);
    expect(result.current.percentUsed).toBeCloseTo(110, 0);
    // Available should be clamped to 0, not negative
    expect(result.current.available).toBe(0);
  });
});
