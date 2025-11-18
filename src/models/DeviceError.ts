/**
 * Device Error Types and Error Handling
 *
 * Provides centralized error handling for SDR device operations with:
 * - Standardized error codes and messages
 * - User-friendly error descriptions
 * - Recovery guidance
 * - Error history tracking integration with diagnostics
 */

/**
 * Standard error codes for device operations
 */
export enum DeviceErrorCode {
  // Connection errors
  DEVICE_NOT_FOUND = "DEVICE_NOT_FOUND",
  DEVICE_DISCONNECTED = "DEVICE_DISCONNECTED",
  DEVICE_BUSY = "DEVICE_BUSY",
  DEVICE_ACCESS_DENIED = "DEVICE_ACCESS_DENIED",

  // Configuration errors
  INVALID_CONFIGURATION = "INVALID_CONFIGURATION",
  SAMPLE_RATE_NOT_SET = "SAMPLE_RATE_NOT_SET",
  FREQUENCY_OUT_OF_RANGE = "FREQUENCY_OUT_OF_RANGE",
  SAMPLE_RATE_OUT_OF_RANGE = "SAMPLE_RATE_OUT_OF_RANGE",

  // USB communication errors
  USB_TRANSFER_TIMEOUT = "USB_TRANSFER_TIMEOUT",
  USB_TRANSFER_FAILED = "USB_TRANSFER_FAILED",
  USB_INVALID_STATE = "USB_INVALID_STATE",
  USB_NETWORK_ERROR = "USB_NETWORK_ERROR",

  // Device state errors
  DEVICE_NOT_OPEN = "DEVICE_NOT_OPEN",
  DEVICE_CLOSING = "DEVICE_CLOSING",
  DEVICE_NOT_STREAMING = "DEVICE_NOT_STREAMING",
  DEVICE_ALREADY_STREAMING = "DEVICE_ALREADY_STREAMING",

  // Recovery errors
  RECOVERY_FAILED = "RECOVERY_FAILED",
  MAX_RETRIES_EXCEEDED = "MAX_RETRIES_EXCEEDED",

  // Generic errors
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

/**
 * Recovery action suggestions for different error types
 */
export enum RecoveryAction {
  NONE = "NONE",
  RETRY = "RETRY",
  RECONNECT = "RECONNECT",
  REPLUG_USB = "REPLUG_USB",
  RESET_DEVICE = "RESET_DEVICE",
  CHECK_USB_PORT = "CHECK_USB_PORT",
  CLOSE_OTHER_APPS = "CLOSE_OTHER_APPS",
  RECONFIGURE = "RECONFIGURE",
}

/**
 * Severity level for errors
 */
export enum ErrorSeverity {
  INFO = "INFO",
  WARNING = "WARNING",
  ERROR = "ERROR",
  CRITICAL = "CRITICAL",
}

/**
 * Device error state
 */
export interface DeviceErrorState {
  /** Error code */
  code: DeviceErrorCode;
  /** User-friendly error message */
  message: string;
  /** Technical details (for logging/diagnostics) */
  details?: string;
  /** Suggested recovery action */
  recoveryAction: RecoveryAction;
  /** Error severity */
  severity: ErrorSeverity;
  /** When the error occurred */
  timestamp: number;
  /** Original error object (if available) */
  originalError?: Error;
  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Error mapping configuration
 */
interface ErrorMapping {
  code: DeviceErrorCode;
  message: string;
  recoveryAction: RecoveryAction;
  severity: ErrorSeverity;
}

/**
 * Map error patterns to standardized error states
 */
const ERROR_MAPPINGS: Array<{
  pattern: RegExp | string;
  mapping: ErrorMapping;
}> = [
  // USB timeout errors
  {
    pattern: /timeout|timed out/i,
    mapping: {
      code: DeviceErrorCode.USB_TRANSFER_TIMEOUT,
      message:
        "Device not responding. The device may need to be reset or reconnected.",
      recoveryAction: RecoveryAction.RESET_DEVICE,
      severity: ErrorSeverity.ERROR,
    },
  },
  // USB disconnection errors
  {
    pattern: /device.*disconnected|no device selected/i,
    mapping: {
      code: DeviceErrorCode.DEVICE_DISCONNECTED,
      message: "Device has been disconnected. Please reconnect the device.",
      recoveryAction: RecoveryAction.REPLUG_USB,
      severity: ErrorSeverity.ERROR,
    },
  },
  // USB busy/access errors
  {
    pattern: /device.*busy|claimed by another process|access denied/i,
    mapping: {
      code: DeviceErrorCode.DEVICE_BUSY,
      message:
        "Device is busy or claimed by another application. Close other SDR applications and try again.",
      recoveryAction: RecoveryAction.CLOSE_OTHER_APPS,
      severity: ErrorSeverity.ERROR,
    },
  },
  // Sample rate configuration errors
  {
    pattern: /sample rate.*not.*configured|must.*call.*setSampleRate/i,
    mapping: {
      code: DeviceErrorCode.SAMPLE_RATE_NOT_SET,
      message:
        "Device not configured. Sample rate must be set before streaming.",
      recoveryAction: RecoveryAction.RECONFIGURE,
      severity: ErrorSeverity.ERROR,
    },
  },
  // Frequency range errors
  {
    pattern: /frequency.*out of range/i,
    mapping: {
      code: DeviceErrorCode.FREQUENCY_OUT_OF_RANGE,
      message: "Frequency is outside the device's supported range.",
      recoveryAction: RecoveryAction.RECONFIGURE,
      severity: ErrorSeverity.WARNING,
    },
  },
  // Sample rate range errors
  {
    pattern: /sample rate.*out of range/i,
    mapping: {
      code: DeviceErrorCode.SAMPLE_RATE_OUT_OF_RANGE,
      message: "Sample rate is outside the device's supported range.",
      recoveryAction: RecoveryAction.RECONFIGURE,
      severity: ErrorSeverity.WARNING,
    },
  },
  // USB invalid state errors
  {
    pattern: /InvalidStateError/i,
    mapping: {
      code: DeviceErrorCode.USB_INVALID_STATE,
      message: "Device is in an invalid state. Attempting automatic recovery.",
      recoveryAction: RecoveryAction.RETRY,
      severity: ErrorSeverity.WARNING,
    },
  },
  // USB network/transfer errors
  {
    pattern: /NetworkError|transfer error/i,
    mapping: {
      code: DeviceErrorCode.USB_NETWORK_ERROR,
      message: "USB communication error. Attempting automatic recovery.",
      recoveryAction: RecoveryAction.RETRY,
      severity: ErrorSeverity.WARNING,
    },
  },
  // Device not open errors
  {
    pattern: /device.*not open|device.*closed/i,
    mapping: {
      code: DeviceErrorCode.DEVICE_NOT_OPEN,
      message: "Device is not open. Please connect a device first.",
      recoveryAction: RecoveryAction.RECONNECT,
      severity: ErrorSeverity.ERROR,
    },
  },
  // Device closing errors
  {
    pattern: /device.*closing/i,
    mapping: {
      code: DeviceErrorCode.DEVICE_CLOSING,
      message: "Device is being closed. Operation cancelled.",
      recoveryAction: RecoveryAction.NONE,
      severity: ErrorSeverity.INFO,
    },
  },
  // Recovery failed errors
  {
    pattern: /recovery failed|fast.?recovery.*failed/i,
    mapping: {
      code: DeviceErrorCode.RECOVERY_FAILED,
      message:
        "Automatic recovery failed. Please unplug and replug the device.",
      recoveryAction: RecoveryAction.REPLUG_USB,
      severity: ErrorSeverity.ERROR,
    },
  },
  // Max retries errors
  {
    pattern: /max.*retries|too many retries/i,
    mapping: {
      code: DeviceErrorCode.MAX_RETRIES_EXCEEDED,
      message: "Maximum retry attempts exceeded. Device may need to be reset.",
      recoveryAction: RecoveryAction.REPLUG_USB,
      severity: ErrorSeverity.ERROR,
    },
  },
];

/**
 * Device Error Handler
 *
 * Provides centralized error handling for device operations with:
 * - Error classification and mapping
 * - User-friendly error messages
 * - Recovery action suggestions
 * - Error history tracking
 *
 * Note: This class uses only static methods as a namespace for error handling utilities.
 */
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class DeviceErrorHandler {
  /**
   * Map a raw error to a standardized DeviceErrorState
   */
  static mapError(
    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
    error: Error | unknown,
    context?: Record<string, unknown>,
  ): DeviceErrorState {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorName = error instanceof Error ? error.name : undefined;

    // Try to match error message against known patterns
    for (const { pattern, mapping } of ERROR_MAPPINGS) {
      const regex = typeof pattern === "string" ? new RegExp(pattern) : pattern;
      if (regex.test(errorMessage) || (errorName && regex.test(errorName))) {
        return {
          ...mapping,
          details: errorMessage,
          timestamp: Date.now(),
          originalError: error instanceof Error ? error : undefined,
          context,
        };
      }
    }

    // Default unknown error
    return {
      code: DeviceErrorCode.UNKNOWN_ERROR,
      message: "An unexpected error occurred with the device.",
      details: errorMessage,
      recoveryAction: RecoveryAction.RETRY,
      severity: ErrorSeverity.ERROR,
      timestamp: Date.now(),
      originalError: error instanceof Error ? error : undefined,
      context,
    };
  }

  /**
   * Get user-friendly recovery instructions for an error
   */
  static getRecoveryInstructions(error: DeviceErrorState): string {
    switch (error.recoveryAction) {
      case RecoveryAction.RETRY:
        return "The system will automatically retry the operation.";
      case RecoveryAction.RECONNECT:
        return "Please reconnect the device and try again.";
      case RecoveryAction.REPLUG_USB:
        return "Please unplug the USB cable, wait 5 seconds, then plug it back in.";
      case RecoveryAction.RESET_DEVICE:
        return "The device will be automatically reset. If the problem persists, unplug and replug the USB cable.";
      case RecoveryAction.CHECK_USB_PORT:
        return "Try using a different USB port, preferably a direct USB 3.0 port (avoid hubs).";
      case RecoveryAction.CLOSE_OTHER_APPS:
        return "Close other applications that may be using the device (SDR#, GQRX, etc.) and try again.";
      case RecoveryAction.RECONFIGURE:
        return "Please adjust the device configuration and try again.";
      case RecoveryAction.NONE:
        return "";
      default:
        return "Please try again or contact support if the problem persists.";
    }
  }

  /**
   * Format error for user display
   */
  static formatUserMessage(error: DeviceErrorState): string {
    const instructions = this.getRecoveryInstructions(error);
    if (instructions) {
      return `${error.message}\n\n${instructions}`;
    }
    return error.message;
  }

  /**
   * Format error for logging/diagnostics
   */
  static formatDiagnosticMessage(error: DeviceErrorState): string {
    let message = `[${error.code}] ${error.message}`;
    if (error.details) {
      message += `\nDetails: ${error.details}`;
    }
    if (error.context) {
      message += `\nContext: ${JSON.stringify(error.context)}`;
    }
    return message;
  }

  /**
   * Check if an error is recoverable
   */
  static isRecoverable(error: DeviceErrorState): boolean {
    return (
      error.recoveryAction !== RecoveryAction.NONE &&
      error.recoveryAction !== RecoveryAction.REPLUG_USB &&
      error.severity !== ErrorSeverity.CRITICAL
    );
  }

  /**
   * Check if automatic recovery should be attempted
   */
  static shouldAttemptAutoRecovery(error: DeviceErrorState): boolean {
    return (
      error.recoveryAction === RecoveryAction.RETRY ||
      error.recoveryAction === RecoveryAction.RESET_DEVICE
    );
  }
}
