import { renderHook, act } from "@testing-library/react";
import { useFrequencyScanner } from "../useFrequencyScanner";
import { HackRFOne } from "../../models/HackRFOne";

// Mock HackRFOne
jest.mock("../../models/HackRFOne");

describe("useFrequencyScanner", () => {
  let mockDevice: jest.Mocked<HackRFOne>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDevice = {
      setFrequency: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<HackRFOne>;
  });

  it("should initialize with idle status", () => {
    const { result } = renderHook(() => useFrequencyScanner(null));

    expect(result.current.state.status).toBe("idle");
    expect(result.current.state.progress).toBe(0);
    expect(result.current.state.activeSignals).toEqual([]);
  });

  it("should start scan with provided config", async () => {
    const mockOnFrequencyChange = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useFrequencyScanner(mockDevice, mockOnFrequencyChange),
    );

    const config = {
      startFrequency: 88e6,
      endFrequency: 89e6,
      stepSize: 0.5e6,
      dwellTime: 50,
      signalThreshold: -60,
    };

    act(() => {
      result.current.startScan(config);
    });

    expect(result.current.state.status).toBe("scanning");
    expect(result.current.state.config).toEqual(config);
    expect(result.current.state.currentFrequency).toBe(config.startFrequency);
  });

  it("should not start scan if device is null", () => {
    const { result } = renderHook(() => useFrequencyScanner(null));

    const config = {
      startFrequency: 88e6,
      endFrequency: 89e6,
      stepSize: 0.5e6,
      dwellTime: 50,
      signalThreshold: -60,
    };

    act(() => {
      result.current.startScan(config);
    });

    expect(result.current.state.status).toBe("idle");
  });

  it("should pause scan", () => {
    const { result } = renderHook(() => useFrequencyScanner(mockDevice));

    const config = {
      startFrequency: 88e6,
      endFrequency: 89e6,
      stepSize: 0.5e6,
      dwellTime: 50,
      signalThreshold: -60,
    };

    act(() => {
      result.current.startScan(config);
    });

    expect(result.current.state.status).toBe("scanning");

    act(() => {
      result.current.pauseScan();
    });

    expect(result.current.state.status).toBe("paused");
  });

  it("should stop scan", () => {
    const { result } = renderHook(() => useFrequencyScanner(mockDevice));

    const config = {
      startFrequency: 88e6,
      endFrequency: 89e6,
      stepSize: 0.5e6,
      dwellTime: 50,
      signalThreshold: -60,
    };

    act(() => {
      result.current.startScan(config);
    });

    expect(result.current.state.status).toBe("scanning");

    act(() => {
      result.current.stopScan();
    });

    expect(result.current.state.status).toBe("idle");
    expect(result.current.state.progress).toBe(0);
  });

  it("should clear active signals", () => {
    const { result } = renderHook(() => useFrequencyScanner(mockDevice));

    // Manually add some signals for testing
    act(() => {
      result.current.state.activeSignals = [
        { frequency: 88e6, signalStrength: -50, timestamp: Date.now() },
      ];
    });

    act(() => {
      result.current.clearSignals();
    });

    expect(result.current.state.activeSignals).toEqual([]);
  });

  it("should update config", () => {
    const { result } = renderHook(() => useFrequencyScanner(mockDevice));

    const initialThreshold = result.current.state.config.signalThreshold;

    act(() => {
      result.current.updateConfig({ signalThreshold: -70 });
    });

    expect(result.current.state.config.signalThreshold).toBe(-70);
    expect(result.current.state.config.signalThreshold).not.toBe(
      initialThreshold,
    );
  });

  it("should have default config for FM frequencies", () => {
    const { result } = renderHook(() => useFrequencyScanner(mockDevice));

    expect(result.current.state.config.startFrequency).toBe(88.1e6);
    expect(result.current.state.config.endFrequency).toBe(107.9e6);
    expect(result.current.state.config.stepSize).toBe(0.2e6);
  });
});
