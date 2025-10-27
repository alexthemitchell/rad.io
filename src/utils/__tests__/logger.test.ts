/**
 * Tests for logger utility
 */

import {
  logger,
  LogLevel,
  LogCategory,
  deviceLogger,
  audioLogger,
} from "../logger";

describe("Logger", () => {
  let consoleDebugSpy: jest.SpyInstance;
  let consoleInfoSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleDebugSpy = jest.spyOn(console, "debug").mockImplementation();
    consoleInfoSpy = jest.spyOn(console, "info").mockImplementation();
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
    
    // Reset logger configuration before each test
    logger.configure({ minLevel: LogLevel.DEBUG, enabledCategories: undefined });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Basic logging", () => {
    it("should log debug messages", () => {
      logger.debug("debug message");
      expect(consoleDebugSpy).toHaveBeenCalled();
    });

    it("should log info messages", () => {
      logger.info("info message");
      expect(consoleInfoSpy).toHaveBeenCalled();
    });

    it("should log warning messages", () => {
      logger.warn("warning message");
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it("should log error messages", () => {
      logger.error("error message");
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe("LogLevel filtering", () => {
    it("should respect minLevel INFO", () => {
      logger.configure({ minLevel: LogLevel.INFO });

      logger.debug("debug message");
      logger.info("info message");

      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleInfoSpy).toHaveBeenCalled();
    });

    it("should respect minLevel WARN", () => {
      logger.configure({ minLevel: LogLevel.WARN });

      logger.debug("debug message");
      logger.info("info message");
      logger.warn("warn message");

      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleInfoSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it("should respect minLevel ERROR", () => {
      logger.configure({ minLevel: LogLevel.ERROR });

      logger.warn("warn message");
      logger.error("error message");

      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("should respect minLevel NONE", () => {
      logger.configure({ minLevel: LogLevel.NONE });

      logger.debug("debug message");
      logger.info("info message");
      logger.warn("warn message");
      logger.error("error message");

      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleInfoSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe("Category filtering", () => {
    it("should log all categories when none specified", () => {
      logger.configure({ minLevel: LogLevel.DEBUG });

      logger.debug("message", undefined, LogCategory.DEVICE);
      logger.debug("message", undefined, LogCategory.DSP);
      logger.debug("message", undefined, LogCategory.AUDIO);

      expect(consoleDebugSpy).toHaveBeenCalledTimes(3);
    });

    it("should filter by enabled categories", () => {
      const enabledCategories = new Set([LogCategory.DEVICE, LogCategory.DSP]);
      logger.configure({ minLevel: LogLevel.DEBUG, enabledCategories });

      logger.debug("device message", undefined, LogCategory.DEVICE);
      logger.debug("dsp message", undefined, LogCategory.DSP);
      logger.debug("audio message", undefined, LogCategory.AUDIO);

      expect(consoleDebugSpy).toHaveBeenCalledTimes(2);
    });

    it("should include category in message", () => {
      logger.configure({
        minLevel: LogLevel.DEBUG,
        includeTimestamp: false,
      });

      logger.debug("test message", undefined, LogCategory.DEVICE);

      expect(consoleDebugSpy).toHaveBeenCalledWith(
        expect.stringContaining(LogCategory.DEVICE)
      );
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        expect.stringContaining("test message")
      );
    });
  });

  describe("Message formatting", () => {
    it("should include timestamp by default", () => {
      logger.configure({ minLevel: LogLevel.DEBUG, includeTimestamp: true });
      logger.debug("test message");

      const call = consoleDebugSpy.mock.calls[0][0];
      expect(call).toMatch(/\[.*?\]/);
    });

    it("should exclude timestamp when configured", () => {
      logger.configure({
        minLevel: LogLevel.DEBUG,
        includeTimestamp: false,
      });

      logger.debug("test message");

      const call = consoleDebugSpy.mock.calls[0][0];
      expect(call).toBe("test message");
    });

    it("should format context object", () => {
      logger.configure({ minLevel: LogLevel.DEBUG });
      const context = { key: "value", number: 42 };

      logger.debug("test message", context);

      expect(consoleDebugSpy).toHaveBeenCalledWith(
        expect.any(String),
        "\n",
        expect.stringContaining('"key"')
      );
    });
  });

  describe("Category-specific loggers", () => {
    it("should automatically apply category in device logger", () => {
      logger.configure({ minLevel: LogLevel.DEBUG, includeTimestamp: false });
      
      deviceLogger.debug("device message");

      expect(consoleDebugSpy).toHaveBeenCalledWith(
        expect.stringContaining(LogCategory.DEVICE)
      );
    });

    it("should automatically apply category in audio logger", () => {
      logger.configure({ minLevel: LogLevel.DEBUG, includeTimestamp: false });
      
      audioLogger.info("audio message");

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining(LogCategory.AUDIO)
      );
    });
  });

  describe("Error logging with context", () => {
    it("should log error with context", () => {
      logger.configure({ minLevel: LogLevel.ERROR });
      const error = new Error("Test error");
      const context = { errorCode: 500 };

      logger.error("error message", error, context);

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.any(String),
        "\n",
        expect.stringContaining("errorCode")
      );
    });

    it("should log error with category", () => {
      logger.configure({ minLevel: LogLevel.ERROR, includeTimestamp: false });

      logger.error("error message", undefined, undefined, LogCategory.DEVICE);

      expect(consoleErrorSpy).toHaveBeenCalled();
      const firstArg = consoleErrorSpy.mock.calls[0][0];
      expect(firstArg).toContain(LogCategory.DEVICE);
      expect(firstArg).toContain("error message");
    });
  });
});
