/**
 * Tests for Device Error Handling
 */

import {
  DeviceErrorCode,
  DeviceErrorHandler,
  RecoveryAction,
  ErrorSeverity,
} from "../DeviceError";

describe("DeviceErrorHandler", () => {
  describe("mapError", () => {
    it("should map timeout errors correctly", () => {
      const error = new Error(
        "transferIn timeout after 1000ms - device may need reset",
      );
      const mapped = DeviceErrorHandler.mapError(error);

      expect(mapped.code).toBe(DeviceErrorCode.USB_TRANSFER_TIMEOUT);
      expect(mapped.severity).toBe(ErrorSeverity.ERROR);
      expect(mapped.recoveryAction).toBe(RecoveryAction.RESET_DEVICE);
      expect(mapped.message).toContain("not responding");
    });

    it("should map disconnection errors correctly", () => {
      const error = new Error("device disconnected");
      const mapped = DeviceErrorHandler.mapError(error);

      expect(mapped.code).toBe(DeviceErrorCode.DEVICE_DISCONNECTED);
      expect(mapped.severity).toBe(ErrorSeverity.ERROR);
      expect(mapped.recoveryAction).toBe(RecoveryAction.REPLUG_USB);
      expect(mapped.message).toContain("disconnected");
    });

    it("should map busy/access errors correctly", () => {
      const error = new Error("device claimed by another process");
      const mapped = DeviceErrorHandler.mapError(error);

      expect(mapped.code).toBe(DeviceErrorCode.DEVICE_BUSY);
      expect(mapped.severity).toBe(ErrorSeverity.ERROR);
      expect(mapped.recoveryAction).toBe(RecoveryAction.CLOSE_OTHER_APPS);
      expect(mapped.message).toContain("busy");
    });

    it("should map sample rate configuration errors correctly", () => {
      const error = new Error(
        "Sample rate not configured. HackRF requires setSampleRate() to be called before receive().",
      );
      const mapped = DeviceErrorHandler.mapError(error);

      expect(mapped.code).toBe(DeviceErrorCode.SAMPLE_RATE_NOT_SET);
      expect(mapped.severity).toBe(ErrorSeverity.ERROR);
      expect(mapped.recoveryAction).toBe(RecoveryAction.RECONFIGURE);
      expect(mapped.message).toContain("not configured");
    });

    it("should map frequency range errors correctly", () => {
      const error = new Error("Frequency 7000 MHz out of range.");
      const mapped = DeviceErrorHandler.mapError(error);

      expect(mapped.code).toBe(DeviceErrorCode.FREQUENCY_OUT_OF_RANGE);
      expect(mapped.severity).toBe(ErrorSeverity.WARNING);
      expect(mapped.recoveryAction).toBe(RecoveryAction.RECONFIGURE);
      expect(mapped.message).toContain("outside");
    });

    it("should map InvalidStateError correctly", () => {
      const error = new Error("InvalidStateError");
      error.name = "InvalidStateError";
      const mapped = DeviceErrorHandler.mapError(error);

      expect(mapped.code).toBe(DeviceErrorCode.USB_INVALID_STATE);
      expect(mapped.severity).toBe(ErrorSeverity.WARNING);
      expect(mapped.recoveryAction).toBe(RecoveryAction.RETRY);
    });

    it("should map NetworkError correctly", () => {
      const error = new Error("NetworkError: transfer failed");
      error.name = "NetworkError";
      const mapped = DeviceErrorHandler.mapError(error);

      expect(mapped.code).toBe(DeviceErrorCode.USB_NETWORK_ERROR);
      expect(mapped.severity).toBe(ErrorSeverity.WARNING);
      expect(mapped.recoveryAction).toBe(RecoveryAction.RETRY);
    });

    it("should map unknown errors with default mapping", () => {
      const error = new Error("Some completely unknown error");
      const mapped = DeviceErrorHandler.mapError(error);

      expect(mapped.code).toBe(DeviceErrorCode.UNKNOWN_ERROR);
      expect(mapped.severity).toBe(ErrorSeverity.ERROR);
      expect(mapped.recoveryAction).toBe(RecoveryAction.RETRY);
      expect(mapped.message).toContain("unexpected error");
    });

    it("should handle non-Error objects", () => {
      const error = "String error message";
      const mapped = DeviceErrorHandler.mapError(error);

      expect(mapped.code).toBe(DeviceErrorCode.UNKNOWN_ERROR);
      expect(mapped.details).toBe("String error message");
    });

    it("should include context in mapped error", () => {
      const error = new Error("Test error");
      const context = { deviceId: "test-123", sampleRate: 20000000 };
      const mapped = DeviceErrorHandler.mapError(error, context);

      expect(mapped.context).toEqual(context);
    });

    it("should include original error", () => {
      const error = new Error("Test error");
      const mapped = DeviceErrorHandler.mapError(error);

      expect(mapped.originalError).toBe(error);
    });

    it("should include timestamp", () => {
      const before = Date.now();
      const error = new Error("Test error");
      const mapped = DeviceErrorHandler.mapError(error);
      const after = Date.now();

      expect(mapped.timestamp).toBeGreaterThanOrEqual(before);
      expect(mapped.timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe("getRecoveryInstructions", () => {
    it("should return appropriate instructions for RETRY", () => {
      const error = DeviceErrorHandler.mapError(new Error("InvalidStateError"));
      const instructions = DeviceErrorHandler.getRecoveryInstructions(error);

      expect(instructions).toContain("automatically retry");
    });

    it("should return appropriate instructions for REPLUG_USB", () => {
      const error = DeviceErrorHandler.mapError(
        new Error("device disconnected"),
      );
      const instructions = DeviceErrorHandler.getRecoveryInstructions(error);

      expect(instructions).toContain("unplug the USB cable");
    });

    it("should return appropriate instructions for RESET_DEVICE", () => {
      const error = DeviceErrorHandler.mapError(new Error("timeout"));
      const instructions = DeviceErrorHandler.getRecoveryInstructions(error);

      expect(instructions).toContain("automatically reset");
    });

    it("should return appropriate instructions for CLOSE_OTHER_APPS", () => {
      const error = DeviceErrorHandler.mapError(new Error("device busy"));
      const instructions = DeviceErrorHandler.getRecoveryInstructions(error);

      expect(instructions).toContain("Close other applications");
    });

    it("should return empty string for NONE", () => {
      const error = DeviceErrorHandler.mapError(new Error("device closing"));
      const instructions = DeviceErrorHandler.getRecoveryInstructions(error);

      expect(instructions).toBe("");
    });
  });

  describe("formatUserMessage", () => {
    it("should combine message and instructions", () => {
      const error = DeviceErrorHandler.mapError(
        new Error("device disconnected"),
      );
      const formatted = DeviceErrorHandler.formatUserMessage(error);

      expect(formatted).toContain("disconnected");
      expect(formatted).toContain("unplug the USB cable");
    });

    it("should return only message when no instructions", () => {
      const error = DeviceErrorHandler.mapError(new Error("device closing"));
      const formatted = DeviceErrorHandler.formatUserMessage(error);

      expect(formatted).toBe(error.message);
    });
  });

  describe("formatDiagnosticMessage", () => {
    it("should include error code and message", () => {
      const error = DeviceErrorHandler.mapError(new Error("test error"));
      const formatted = DeviceErrorHandler.formatDiagnosticMessage(error);

      expect(formatted).toContain(error.code);
      expect(formatted).toContain(error.message);
    });

    it("should include details", () => {
      const error = DeviceErrorHandler.mapError(new Error("detailed error"));
      const formatted = DeviceErrorHandler.formatDiagnosticMessage(error);

      expect(formatted).toContain("Details:");
      expect(formatted).toContain("detailed error");
    });

    it("should include context when present", () => {
      const error = DeviceErrorHandler.mapError(new Error("test error"), {
        deviceId: "test-123",
      });
      const formatted = DeviceErrorHandler.formatDiagnosticMessage(error);

      expect(formatted).toContain("Context:");
      expect(formatted).toContain("deviceId");
    });
  });

  describe("isRecoverable", () => {
    it("should return true for retryable errors", () => {
      const error = DeviceErrorHandler.mapError(new Error("InvalidStateError"));
      expect(DeviceErrorHandler.isRecoverable(error)).toBe(true);
    });

    it("should return false for REPLUG_USB action", () => {
      const error = DeviceErrorHandler.mapError(
        new Error("device disconnected"),
      );
      expect(DeviceErrorHandler.isRecoverable(error)).toBe(false);
    });

    it("should return false for NONE action", () => {
      const error = DeviceErrorHandler.mapError(new Error("device closing"));
      expect(DeviceErrorHandler.isRecoverable(error)).toBe(false);
    });
  });

  describe("shouldAttemptAutoRecovery", () => {
    it("should return true for RETRY action", () => {
      const error = DeviceErrorHandler.mapError(new Error("InvalidStateError"));
      expect(DeviceErrorHandler.shouldAttemptAutoRecovery(error)).toBe(true);
    });

    it("should return true for RESET_DEVICE action", () => {
      const error = DeviceErrorHandler.mapError(new Error("timeout"));
      expect(DeviceErrorHandler.shouldAttemptAutoRecovery(error)).toBe(true);
    });

    it("should return false for REPLUG_USB action", () => {
      const error = DeviceErrorHandler.mapError(
        new Error("device disconnected"),
      );
      expect(DeviceErrorHandler.shouldAttemptAutoRecovery(error)).toBe(false);
    });

    it("should return false for CLOSE_OTHER_APPS action", () => {
      const error = DeviceErrorHandler.mapError(new Error("device busy"));
      expect(DeviceErrorHandler.shouldAttemptAutoRecovery(error)).toBe(false);
    });
  });
});
