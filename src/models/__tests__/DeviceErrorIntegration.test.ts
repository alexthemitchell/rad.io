/**
 * Integration tests for device error handling across driver layers
 */

import { HackRFOne } from "../../drivers/hackrf/HackRFOne";
import { HackRFOneAdapter } from "../../drivers/hackrf/HackRFOneAdapter";
import {
  DeviceErrorHandler,
  DeviceErrorCode,
  RecoveryAction,
} from "../DeviceError";
import { useStore } from "../../store";

// Mock USB device for testing
const createMockUSBDevice = (overrides?: Partial<USBDevice>): USBDevice => {
  const mockDevice = {
    vendorId: 0x1d50,
    productId: 0x6089,
    productName: "HackRF One",
    serialNumber: "TEST123",
    opened: false,
    configuration: null,
    configurations: [
      {
        configurationValue: 1,
        interfaces: [
          {
            interfaceNumber: 0,
            claimed: false,
            alternates: [
              {
                alternateSetting: 0,
                interfaceClass: 255,
                endpoints: [
                  {
                    endpointNumber: 1,
                    direction: "in" as USBDirection,
                    type: "bulk" as USBEndpointType,
                    packetSize: 512,
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    open: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    selectConfiguration: jest.fn().mockResolvedValue(undefined),
    claimInterface: jest.fn().mockResolvedValue(undefined),
    releaseInterface: jest.fn().mockResolvedValue(undefined),
    selectAlternateInterface: jest.fn().mockResolvedValue(undefined),
    controlTransferIn: jest.fn(),
    controlTransferOut: jest.fn(),
    transferIn: jest.fn(),
    transferOut: jest.fn(),
    reset: jest.fn().mockResolvedValue(undefined),
    forget: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as USBDevice;

  return mockDevice;
};

describe("Device Error Handling Integration", () => {
  let mockDevice: USBDevice;
  let adapter: HackRFOneAdapter;

  beforeEach(() => {
    mockDevice = createMockUSBDevice();
    adapter = new HackRFOneAdapter(mockDevice);

    // Clear diagnostics state before each test
    useStore.getState().resetDiagnostics();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Error Tracking in Diagnostics", () => {
    it("should track device initialization errors", async () => {
      const error = new Error("Device disconnected");
      (mockDevice.open as jest.Mock).mockRejectedValue(error);

      await expect(adapter.open()).rejects.toThrow();

      const { deviceErrors } = useStore.getState();
      expect(deviceErrors.length).toBe(1);
      expect(deviceErrors[0].code).toBe(DeviceErrorCode.DEVICE_DISCONNECTED);
      expect(deviceErrors[0].recoveryAction).toBe(RecoveryAction.REPLUG_USB);
    });

    it("should track configuration errors", async () => {
      // Skip open to avoid USB interface setup complexity
      // This test is about validating error tracking, not USB mocking

      // Directly test the validation error
      try {
        // Try to receive without setting sample rate (without opening device)
        // This should throw a validation error
        await adapter.receive(jest.fn());
      } catch (err) {
        // Error expected - verify it was tracked
      }

      const { deviceErrors } = useStore.getState();
      // Should have tracked the validation error
      expect(deviceErrors.length).toBeGreaterThan(0);
    });

    it("should track USB communication errors", async () => {
      const error = new Error("NetworkError: transfer failed");
      error.name = "NetworkError";
      (mockDevice.controlTransferOut as jest.Mock).mockRejectedValue(error);

      // Open device (will fail due to control transfer error)
      await expect(async () => {
        await adapter.open();
        // Try to set sample rate which will trigger control transfer
        await adapter.setSampleRate(20e6);
      }).rejects.toThrow();

      const { deviceErrors } = useStore.getState();
      expect(deviceErrors.length).toBeGreaterThan(0);
    });

    it("should limit error history to 50 entries", async () => {
      // Generate 60 errors
      for (let i = 0; i < 60; i++) {
        const error = new Error(`Test error ${i}`);
        const errorState = DeviceErrorHandler.mapError(error);
        useStore.getState().addDeviceError(errorState);
      }

      const { deviceErrors } = useStore.getState();
      expect(deviceErrors.length).toBe(50);
    });

    it("should include context in tracked errors", async () => {
      (mockDevice.open as jest.Mock).mockRejectedValue(
        new Error("device busy"),
      );

      await expect(adapter.open()).rejects.toThrow();

      const { deviceErrors } = useStore.getState();
      expect(deviceErrors.length).toBe(1);
      expect(deviceErrors[0].context).toMatchObject({
        operation: "open",
        deviceId: expect.stringContaining("7504:24713"),
      });
    });
  });

  describe("Error Recovery Integration", () => {
    it("should detect recoverable vs non-recoverable errors", () => {
      const recoverableError = new Error("InvalidStateError");
      recoverableError.name = "InvalidStateError";
      const errorState = DeviceErrorHandler.mapError(recoverableError);

      expect(DeviceErrorHandler.isRecoverable(errorState)).toBe(true);
      expect(DeviceErrorHandler.shouldAttemptAutoRecovery(errorState)).toBe(
        true,
      );

      const nonRecoverableError = new Error("device disconnected");
      const nonRecoverableState =
        DeviceErrorHandler.mapError(nonRecoverableError);

      expect(DeviceErrorHandler.isRecoverable(nonRecoverableState)).toBe(false);
      expect(
        DeviceErrorHandler.shouldAttemptAutoRecovery(nonRecoverableState),
      ).toBe(false);
    });

    it("should provide appropriate recovery instructions", () => {
      const timeoutError = new Error("timeout");
      const errorState = DeviceErrorHandler.mapError(timeoutError);

      const instructions =
        DeviceErrorHandler.getRecoveryInstructions(errorState);

      expect(instructions).toContain("automatically reset");
      expect(errorState.recoveryAction).toBe(RecoveryAction.RESET_DEVICE);
    });

    it("should format user-friendly error messages", () => {
      const error = new Error("device disconnected");
      const errorState = DeviceErrorHandler.mapError(error);

      const userMessage = DeviceErrorHandler.formatUserMessage(errorState);

      expect(userMessage).toContain("disconnected");
      expect(userMessage).toContain("unplug");
      expect(userMessage).not.toContain("Error:");
    });

    it("should format diagnostic messages with technical details", () => {
      const error = new Error("device disconnected");
      const errorState = DeviceErrorHandler.mapError(error, {
        deviceId: "test-123",
        attempt: 3,
      });

      const diagnosticMessage =
        DeviceErrorHandler.formatDiagnosticMessage(errorState);

      expect(diagnosticMessage).toContain(errorState.code);
      expect(diagnosticMessage).toContain("Details:");
      expect(diagnosticMessage).toContain("Context:");
      expect(diagnosticMessage).toContain("deviceId");
    });
  });

  describe("Error Mapping Accuracy", () => {
    const testCases: Array<{
      name: string;
      error: Error;
      expectedCode: DeviceErrorCode;
      expectedAction: RecoveryAction;
    }> = [
      {
        name: "timeout errors",
        error: new Error("transferIn timeout after 1000ms"),
        expectedCode: DeviceErrorCode.USB_TRANSFER_TIMEOUT,
        expectedAction: RecoveryAction.RESET_DEVICE,
      },
      {
        name: "disconnection errors",
        error: new Error("No device selected"),
        expectedCode: DeviceErrorCode.DEVICE_DISCONNECTED,
        expectedAction: RecoveryAction.REPLUG_USB,
      },
      {
        name: "busy errors",
        error: new Error("claimed by another process"),
        expectedCode: DeviceErrorCode.DEVICE_BUSY,
        expectedAction: RecoveryAction.CLOSE_OTHER_APPS,
      },
      {
        name: "sample rate errors",
        error: new Error("Sample rate not configured"),
        expectedCode: DeviceErrorCode.SAMPLE_RATE_NOT_SET,
        expectedAction: RecoveryAction.RECONFIGURE,
      },
      {
        name: "frequency range errors",
        error: new Error("Frequency out of range"),
        expectedCode: DeviceErrorCode.FREQUENCY_OUT_OF_RANGE,
        expectedAction: RecoveryAction.RECONFIGURE,
      },
    ];

    testCases.forEach(({ name, error, expectedCode, expectedAction }) => {
      it(`should correctly map ${name}`, () => {
        const errorState = DeviceErrorHandler.mapError(error);

        expect(errorState.code).toBe(expectedCode);
        expect(errorState.recoveryAction).toBe(expectedAction);
        expect(errorState.originalError).toBe(error);
        expect(errorState.timestamp).toBeDefined();
      });
    });
  });

  describe("Cross-Layer Error Propagation", () => {
    it("should propagate errors from HackRFOne to HackRFOneAdapter", async () => {
      const error = new Error("USB transfer failed");
      (mockDevice.open as jest.Mock).mockRejectedValue(error);

      await expect(adapter.open()).rejects.toThrow("USB transfer failed");

      const { deviceErrors } = useStore.getState();
      expect(deviceErrors.length).toBeGreaterThan(0);
    });

    it("should preserve error context through layers", async () => {
      (mockDevice.open as jest.Mock).mockRejectedValue(
        new Error("device busy"),
      );

      try {
        await adapter.open();
      } catch {
        // Expected
      }

      const { deviceErrors } = useStore.getState();
      const latestError = deviceErrors[deviceErrors.length - 1];

      expect(latestError.context).toMatchObject({
        operation: "open",
        deviceType: "HackRF One",
      });
    });
  });

  describe("Error History Management", () => {
    it("should allow clearing error history", () => {
      // Add some errors
      for (let i = 0; i < 10; i++) {
        const error = new Error(`Test error ${i}`);
        const errorState = DeviceErrorHandler.mapError(error);
        useStore.getState().addDeviceError(errorState);
      }

      expect(useStore.getState().deviceErrors.length).toBe(10);

      useStore.getState().clearDeviceErrors();

      expect(useStore.getState().deviceErrors.length).toBe(0);
    });

    it("should reset all diagnostics including errors", () => {
      // Add errors and other diagnostics
      const error = new Error("Test error");
      const errorState = DeviceErrorHandler.mapError(error);
      useStore.getState().addDeviceError(errorState);

      useStore.getState().addDiagnosticEvent({
        source: "device",
        severity: "error",
        message: "Test event",
      });

      expect(useStore.getState().deviceErrors.length).toBe(1);
      expect(useStore.getState().events.length).toBe(1);

      useStore.getState().resetDiagnostics();

      expect(useStore.getState().deviceErrors.length).toBe(0);
      expect(useStore.getState().events.length).toBe(0);
    });

    it("should maintain error timestamps", () => {
      const before = Date.now();

      const error = new Error("Test error");
      const errorState = DeviceErrorHandler.mapError(error);
      useStore.getState().addDeviceError(errorState);

      const after = Date.now();

      const { deviceErrors } = useStore.getState();
      expect(deviceErrors[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(deviceErrors[0].timestamp).toBeLessThanOrEqual(after);
    });
  });
});
