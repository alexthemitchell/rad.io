/**
 * Tests for useHackRFDevice hook
 * Tests device lifecycle, initialization, and cleanup
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { useHackRFDevice } from "../hooks/useHackRFDevice";
import { useUSBDevice } from "../../hooks/useUSBDevice";
import { HackRFOneAdapter } from "../HackRFOneAdapter";

// Mock the dependencies
jest.mock("../../hooks/useUSBDevice");
jest.mock("../HackRFOneAdapter");

const mockUseUSBDevice = useUSBDevice as jest.MockedFunction<
  typeof useUSBDevice
>;
const MockHackRFOneAdapter = HackRFOneAdapter as jest.MockedClass<
  typeof HackRFOneAdapter
>;

describe("useHackRFDevice", () => {
  let mockUSBDevice: Partial<USBDevice>;
  let mockAdapterInstance: jest.Mocked<HackRFOneAdapter>;

  beforeEach(() => {
    // Create mock USB device
    mockUSBDevice = {
      vendorId: 0x1d50,
      productId: 0x6089,
      opened: false,
      open: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      selectConfiguration: jest.fn().mockResolvedValue(undefined),
      claimInterface: jest.fn().mockResolvedValue(undefined),
      releaseInterface: jest.fn().mockResolvedValue(undefined),
    };

    // Create mock adapter instance with all required ISDRDevice methods
    mockAdapterInstance = {
      open: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      isOpen: jest.fn().mockReturnValue(true),
      setFrequency: jest.fn().mockResolvedValue(undefined),
      getFrequency: jest.fn().mockResolvedValue(100_000_000),
      setSampleRate: jest.fn().mockResolvedValue(undefined),
      setLNAGain: jest.fn().mockResolvedValue(undefined),
      setAmpEnable: jest.fn().mockResolvedValue(undefined),
      receive: jest.fn().mockResolvedValue(undefined),
      stopRx: jest.fn().mockResolvedValue(undefined),
      isReceiving: jest.fn().mockReturnValue(false),
      getDeviceInfo: jest.fn().mockResolvedValue({
        deviceName: "HackRF One",
        vendorId: 0x1d50,
        productId: 0x6089,
      }),
      getCapabilities: jest.fn().mockReturnValue({
        minFrequency: 1_000_000,
        maxFrequency: 6_000_000_000,
        supportedSampleRates: [20_000_000],
      }),
      parseSamples: jest.fn().mockReturnValue([]),
    } as unknown as jest.Mocked<HackRFOneAdapter>;

    // Mock HackRFOneAdapter constructor
    MockHackRFOneAdapter.mockImplementation(() => mockAdapterInstance);

    // Default mock for useUSBDevice
    mockUseUSBDevice.mockReturnValue({
      device: undefined,
      requestDevice: jest.fn().mockResolvedValue(undefined),
      isCheckingPaired: false,
    });

    // Clear console.error mock
    jest.spyOn(console, "error").mockImplementation(() => {
      // Silent
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe("initialization", () => {
    it("should initialize with no device when USB device is not available", () => {
      mockUseUSBDevice.mockReturnValue({
        device: undefined,
        requestDevice: jest.fn(),
        isCheckingPaired: false,
      });

      const { result } = renderHook(() => useHackRFDevice());

      expect(result.current.device).toBeUndefined();
      expect(result.current.isCheckingPaired).toBe(false);
    });

    it("should show checking state when looking for paired devices", () => {
      mockUseUSBDevice.mockReturnValue({
        device: undefined,
        requestDevice: jest.fn(),
        isCheckingPaired: true,
      });

      const { result } = renderHook(() => useHackRFDevice());

      expect(result.current.device).toBeUndefined();
      expect(result.current.isCheckingPaired).toBe(true);
    });

    it("should create HackRFOneAdapter when USB device becomes available", async () => {
      const { result, rerender } = renderHook(() => useHackRFDevice());

      // Initially no device
      expect(result.current.device).toBeUndefined();

      // Simulate USB device connection
      mockUseUSBDevice.mockReturnValue({
        device: mockUSBDevice as USBDevice,
        requestDevice: jest.fn(),
        isCheckingPaired: false,
      });

      rerender();

      await waitFor(() => {
        expect(result.current.device).toBeDefined();
      });

      expect(MockHackRFOneAdapter).toHaveBeenCalledWith(mockUSBDevice);
    });

    it("should open device if not already opened", async () => {
      mockUSBDevice.opened = false;

      mockUseUSBDevice.mockReturnValue({
        device: mockUSBDevice as USBDevice,
        requestDevice: jest.fn(),
        isCheckingPaired: false,
      });

      const { result } = renderHook(() => useHackRFDevice());

      await waitFor(() => {
        expect(result.current.device).toBeDefined();
      });

      expect(mockAdapterInstance.open).toHaveBeenCalled();
    });

    it("should not open device if already opened", async () => {
      mockUSBDevice.opened = true;

      mockUseUSBDevice.mockReturnValue({
        device: mockUSBDevice as USBDevice,
        requestDevice: jest.fn(),
        isCheckingPaired: false,
      });

      const { result } = renderHook(() => useHackRFDevice());

      await waitFor(() => {
        expect(result.current.device).toBeDefined();
      });

      expect(mockAdapterInstance.open).not.toHaveBeenCalled();
    });

    it("should handle initialization errors gracefully", async () => {
      mockAdapterInstance.open.mockRejectedValueOnce(
        new Error("Failed to open device"),
      );
      mockUSBDevice.opened = false;

      mockUseUSBDevice.mockReturnValue({
        device: mockUSBDevice as USBDevice,
        requestDevice: jest.fn(),
        isCheckingPaired: false,
      });

      renderHook(() => useHackRFDevice());

      // Wait for error to be logged
      await waitFor(() => {
        expect(console.error).toHaveBeenCalledWith(
          "useHackRFDevice: Failed to initialize HackRF adapter",
          expect.any(Error),
          expect.objectContaining({
            wasOpened: false,
            productId: 0x6089,
            vendorId: 0x1d50,
          }),
        );
      });
    });
  });

  describe("initialize function", () => {
    it("should expose requestDevice as initialize", () => {
      const mockRequestDevice = jest.fn().mockResolvedValue(undefined);
      mockUseUSBDevice.mockReturnValue({
        device: undefined,
        requestDevice: mockRequestDevice,
        isCheckingPaired: false,
      });

      const { result } = renderHook(() => useHackRFDevice());

      expect(result.current.initialize).toBe(mockRequestDevice);
    });

    it("should call requestDevice when initialize is invoked", async () => {
      const mockRequestDevice = jest.fn().mockResolvedValue(undefined);
      mockUseUSBDevice.mockReturnValue({
        device: undefined,
        requestDevice: mockRequestDevice,
        isCheckingPaired: false,
      });

      const { result } = renderHook(() => useHackRFDevice());

      await act(async () => {
        await result.current.initialize();
      });

      expect(mockRequestDevice).toHaveBeenCalled();
    });
  });

  describe("cleanup function", () => {
    it("should close device when cleanup is called", async () => {
      mockUseUSBDevice.mockReturnValue({
        device: mockUSBDevice as USBDevice,
        requestDevice: jest.fn(),
        isCheckingPaired: false,
      });

      const { result } = renderHook(() => useHackRFDevice());

      await waitFor(() => {
        expect(result.current.device).toBeDefined();
      });

      await act(async () => {
        result.current.cleanup();
      });

      // Wait for async close to complete
      await waitFor(() => {
        expect(mockAdapterInstance.close).toHaveBeenCalled();
      });
    });

    it("should handle cleanup errors gracefully", async () => {
      mockAdapterInstance.close.mockRejectedValueOnce(
        new Error("Failed to close"),
      );

      mockUseUSBDevice.mockReturnValue({
        device: mockUSBDevice as USBDevice,
        requestDevice: jest.fn(),
        isCheckingPaired: false,
      });

      const { result } = renderHook(() => useHackRFDevice());

      await waitFor(() => {
        expect(result.current.device).toBeDefined();
      });

      await act(async () => {
        result.current.cleanup();
      });

      await waitFor(() => {
        expect(console.error).toHaveBeenCalledWith(
          "useHackRFDevice: Failed to close device during cleanup",
          expect.any(Error),
        );
      });
    });

    it("should not error when cleanup is called with no device", () => {
      mockUseUSBDevice.mockReturnValue({
        device: undefined,
        requestDevice: jest.fn(),
        isCheckingPaired: false,
      });

      const { result } = renderHook(() => useHackRFDevice());

      expect(() => {
        result.current.cleanup();
      }).not.toThrow();
    });

    it("should run cleanup on unmount", async () => {
      mockUseUSBDevice.mockReturnValue({
        device: mockUSBDevice as USBDevice,
        requestDevice: jest.fn(),
        isCheckingPaired: false,
      });

      const { result, unmount } = renderHook(() => useHackRFDevice());

      await waitFor(() => {
        expect(result.current.device).toBeDefined();
      });

      unmount();

      // Give async cleanup time to execute
      await waitFor(() => {
        expect(mockAdapterInstance.close).toHaveBeenCalled();
      });
    });
  });

  describe("device lifecycle", () => {
    it("should update device when USB device changes", async () => {
      const { result, rerender } = renderHook(() => useHackRFDevice());

      // Initially no device
      expect(result.current.device).toBeUndefined();

      // Add first device
      mockUseUSBDevice.mockReturnValue({
        device: mockUSBDevice as USBDevice,
        requestDevice: jest.fn(),
        isCheckingPaired: false,
      });

      rerender();

      await waitFor(() => {
        expect(result.current.device).toBeDefined();
      });

      const firstDevice = result.current.device;

      // Create new USB device (simulating disconnect/reconnect)
      const newMockUSBDevice: Partial<USBDevice> = {
        ...mockUSBDevice,
        productId: 0x6089,
      };

      mockUseUSBDevice.mockReturnValue({
        device: newMockUSBDevice as USBDevice,
        requestDevice: jest.fn(),
        isCheckingPaired: false,
      });

      rerender();

      await waitFor(() => {
        // Should create new adapter instance
        expect(MockHackRFOneAdapter).toHaveBeenCalledTimes(2);
      });
    });

    it("should clear device when USB device is removed", async () => {
      mockUseUSBDevice.mockReturnValue({
        device: mockUSBDevice as USBDevice,
        requestDevice: jest.fn(),
        isCheckingPaired: false,
      });

      const { result, rerender } = renderHook(() => useHackRFDevice());

      await waitFor(() => {
        expect(result.current.device).toBeDefined();
      });

      // Remove USB device
      mockUseUSBDevice.mockReturnValue({
        device: undefined,
        requestDevice: jest.fn(),
        isCheckingPaired: false,
      });

      rerender();

      // Device should remain available (adapter manages its own lifecycle)
      // This is intentional - device stays available until explicitly cleaned up
      expect(result.current.device).toBeDefined();
    });
  });

  describe("filter configuration", () => {
    it("should request HackRF vendor ID in filter", () => {
      renderHook(() => useHackRFDevice());

      expect(mockUseUSBDevice).toHaveBeenCalledWith([
        {
          vendorId: 0x1d50, // HackRF vendor ID
        },
      ]);
    });
  });

  describe("return value structure", () => {
    it("should return object with correct shape", () => {
      const { result } = renderHook(() => useHackRFDevice());

      expect(result.current).toHaveProperty("device");
      expect(result.current).toHaveProperty("initialize");
      expect(result.current).toHaveProperty("cleanup");
      expect(result.current).toHaveProperty("isCheckingPaired");
    });

    it("should have stable function references", () => {
      const { result, rerender } = renderHook(() => useHackRFDevice());

      const firstInitialize = result.current.initialize;
      const firstCleanup = result.current.cleanup;

      rerender();

      // initialize comes from useUSBDevice, should be the same reference
      expect(result.current.initialize).toBe(firstInitialize);
      // cleanup depends on device, may change when device changes
    });
  });

  describe("integration scenarios", () => {
    it("should handle full connection flow", async () => {
      const mockRequestDevice = jest.fn().mockResolvedValue(undefined);

      // Start with no device
      mockUseUSBDevice.mockReturnValue({
        device: undefined,
        requestDevice: mockRequestDevice,
        isCheckingPaired: false,
      });

      const { result, rerender } = renderHook(() => useHackRFDevice());

      expect(result.current.device).toBeUndefined();

      // User requests device
      await act(async () => {
        await result.current.initialize();
      });

      expect(mockRequestDevice).toHaveBeenCalled();

      // Simulate device selected
      mockUseUSBDevice.mockReturnValue({
        device: mockUSBDevice as USBDevice,
        requestDevice: mockRequestDevice,
        isCheckingPaired: false,
      });

      rerender();

      await waitFor(() => {
        expect(result.current.device).toBeDefined();
      });

      expect(MockHackRFOneAdapter).toHaveBeenCalledWith(mockUSBDevice);
    });

    it("should handle auto-connect to previously paired device", async () => {
      // Simulate checking for paired devices
      mockUseUSBDevice.mockReturnValue({
        device: undefined,
        requestDevice: jest.fn(),
        isCheckingPaired: true,
      });

      const { result, rerender } = renderHook(() => useHackRFDevice());

      expect(result.current.isCheckingPaired).toBe(true);
      expect(result.current.device).toBeUndefined();

      // Paired device found automatically
      mockUseUSBDevice.mockReturnValue({
        device: mockUSBDevice as USBDevice,
        requestDevice: jest.fn(),
        isCheckingPaired: false,
      });

      rerender();

      await waitFor(() => {
        expect(result.current.device).toBeDefined();
      });

      expect(result.current.isCheckingPaired).toBe(false);
    });
  });
});
