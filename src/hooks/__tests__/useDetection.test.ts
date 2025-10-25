/**
 * useDetection Hook Tests
 */

import { renderHook, waitFor } from "@testing-library/react";
import { useDetection } from "../useDetection";
import { DetectionManager } from "../../lib/detection/detection-manager";

// Mock DetectionManager
jest.mock("../../lib/detection/detection-manager");

describe("useDetection", () => {
  let mockManager: jest.Mocked<DetectionManager>;

  beforeEach(() => {
    mockManager = {
      initialize: jest.fn().mockResolvedValue(undefined),
      onDetection: jest.fn(),
      onNoiseFloor: jest.fn(),
      destroy: jest.fn(),
      detectSignals: jest.fn(),
    } as any;

    (DetectionManager as jest.Mock).mockImplementation(() => mockManager);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should initialize with default state", () => {
    const { result } = renderHook(() => useDetection(false));

    expect(result.current.signals).toEqual([]);
    expect(result.current.noiseFloor).toBe(-Infinity);
    expect(result.current.isInitialized).toBe(false);
    expect(result.current.detectionManager).toBeNull();
  });

  it("should auto-initialize when enabled", async () => {
    const { result } = renderHook(() => useDetection(true));

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });

    expect(mockManager.initialize).toHaveBeenCalled();
    expect(mockManager.onDetection).toHaveBeenCalled();
    expect(mockManager.onNoiseFloor).toHaveBeenCalled();
  });

  it("should not auto-initialize when disabled", () => {
    const { result } = renderHook(() => useDetection(false));

    expect(result.current.isInitialized).toBe(false);
    expect(mockManager.initialize).not.toHaveBeenCalled();
  });

  it("should update signals when detection callback fires", async () => {
    let detectionCallback: ((signals: any[]) => void) | null = null;

    mockManager.onDetection.mockImplementation((callback) => {
      detectionCallback = callback;
    });

    const { result } = renderHook(() => useDetection(true));

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });

    // Simulate signal detection
    const mockSignals = [
      {
        binIndex: 100,
        frequency: 146_000_000,
        power: -50,
        bandwidth: 15_000,
        snr: 30,
        type: "narrowband-fm" as const,
        confidence: 0.8,
      },
    ];

    detectionCallback!(mockSignals);

    await waitFor(() => {
      expect(result.current.signals).toEqual(mockSignals);
    });
  });

  it("should update noise floor when callback fires", async () => {
    let noiseFloorCallback: ((floor: number) => void) | null = null;

    mockManager.onNoiseFloor.mockImplementation((callback) => {
      noiseFloorCallback = callback;
    });

    const { result } = renderHook(() => useDetection(true));

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });

    // Simulate noise floor update
    noiseFloorCallback!(-75);

    await waitFor(() => {
      expect(result.current.noiseFloor).toBe(-75);
    });
  });

  it("should accumulate signals over multiple detections", async () => {
    let detectionCallback: ((signals: any[]) => void) | null = null;

    mockManager.onDetection.mockImplementation((callback) => {
      detectionCallback = callback;
    });

    const { result } = renderHook(() => useDetection(true));

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });

    // First detection
    detectionCallback!([
      {
        binIndex: 100,
        frequency: 146_000_000,
        power: -50,
        bandwidth: 15_000,
        snr: 30,
        type: "narrowband-fm" as const,
        confidence: 0.8,
      },
    ]);

    await waitFor(() => {
      expect(result.current.signals.length).toBe(1);
    });

    // Second detection
    detectionCallback!([
      {
        binIndex: 200,
        frequency: 146_500_000,
        power: -45,
        bandwidth: 15_000,
        snr: 35,
        type: "narrowband-fm" as const,
        confidence: 0.9,
      },
    ]);

    await waitFor(() => {
      expect(result.current.signals.length).toBe(2);
    });
  });

  it("should clear signals", async () => {
    let detectionCallback: ((signals: any[]) => void) | null = null;

    mockManager.onDetection.mockImplementation((callback) => {
      detectionCallback = callback;
    });

    const { result } = renderHook(() => useDetection(true));

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });

    // Add signals
    detectionCallback!([
      {
        binIndex: 100,
        frequency: 146_000_000,
        power: -50,
        bandwidth: 15_000,
        snr: 30,
        type: "narrowband-fm" as const,
        confidence: 0.8,
      },
    ]);

    await waitFor(() => {
      expect(result.current.signals.length).toBe(1);
    });

    // Clear signals
    result.current.clearSignals();

    await waitFor(() => {
      expect(result.current.signals).toEqual([]);
    });
  });

  it("should cleanup on unmount", async () => {
    const { unmount } = renderHook(() => useDetection(true));

    await waitFor(() => {
      expect(mockManager.initialize).toHaveBeenCalled();
    });

    unmount();

    expect(mockManager.destroy).toHaveBeenCalled();
  });
});
