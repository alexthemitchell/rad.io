/**/**

 * Tests for Logger utility * Tests for Logger utility

 */ */



import {import {

  LogLevel,  LogLevel,

  LogCategory,  LogCategory,

  OperationLogger,  OperationLogger,

  createOperationLogger,  createOperationLogger,

  logger,  logger,

  deviceLogger,  deviceLogger,

  dspLogger,  dspLogger,

  audioLogger,  audioLogger,

  webglLogger,  webglLogger,

  workerLogger,  workerLogger,

  dataFlowLogger,  dataFlowLogger,

  performanceLogger,  performanceLogger,

  recoveryLogger,  recoveryLogger,

  userActionLogger,  userActionLogger,

  usbLogger,  usbLogger,

} from "../logger";} from "../logger";



describe("Logger", () => {describe("Logger", () => {

  let consoleSpies: {  let consoleSpies: {

    info: jest.SpyInstance;    info: jest.SpyInstance;

    warn: jest.SpyInstance;    warn: jest.SpyInstance;

    error: jest.SpyInstance;    error: jest.SpyInstance;

    debug: jest.SpyInstance;    debug: jest.SpyInstance;

  };  };



  beforeEach(() => {  beforeEach(() => {

    // Spy on console methods    // Spy on console methods

    consoleSpies = {    consoleSpies = {

      info: jest.spyOn(console, "info").mockImplementation(),      info: jest.spyOn(console, "info").mockImplementation(),

      warn: jest.spyOn(console, "warn").mockImplementation(),      warn: jest.spyOn(console, "warn").mockImplementation(),

      error: jest.spyOn(console, "error").mockImplementation(),      error: jest.spyOn(console, "error").mockImplementation(),

      debug: jest.spyOn(console, "debug").mockImplementation(),      debug: jest.spyOn(console, "debug").mockImplementation(),

    };    };

  });  });



  afterEach(() => {  afterEach(() => {

    // Restore console methods    // Restore console methods

    Object.values(consoleSpies).forEach((spy) => spy.mockRestore());    Object.values(consoleSpies).forEach((spy) => spy.mockRestore());

    // Reset logger configuration    // Reset logger configuration

    logger.configure({ minLevel: LogLevel.INFO, enabledCategories: undefined });    logger.configure({ minLevel: LogLevel.INFO, enabledCategories: undefined });

  });  });



  describe("Global logger", () => {  describe("Global logger", () => {

    it("should log debug message when level allows", () => {    it("should log debug message when level allows", () => {

      logger.configure({ minLevel: LogLevel.DEBUG });      logger.configure({ minLevel: LogLevel.DEBUG });

      logger.debug("test message");      logger.debug("test message");



      expect(consoleSpies.debug).toHaveBeenCalled();      expect(consoleSpies.debug).toHaveBeenCalled();

      const callArg = consoleSpies.debug.mock.calls[0][0] as string;      const callArg = consoleSpies.debug.mock.calls[0][0] as string;

      expect(callArg).toContain("test message");      expect(callArg).toContain("test message");

    });    });



    it("should not log debug when level is higher", () => {    it("should not log debug when level is higher", () => {

      logger.configure({ minLevel: LogLevel.INFO });      logger.configure({ minLevel: LogLevel.INFO });

      logger.debug("test message");      logger.debug("test message");



      expect(consoleSpies.debug).not.toHaveBeenCalled();      expect(consoleSpies.debug).not.toHaveBeenCalled();

    });    });



    it("should log info message", () => {    it("should log info message", () => {

      logger.configure({ minLevel: LogLevel.INFO });      logger.configure({ minLevel: LogLevel.INFO });

      logger.info("test message");      logger.info("test message");



      expect(consoleSpies.info).toHaveBeenCalled();      expect(consoleSpies.info).toHaveBeenCalled();

      const callArg = consoleSpies.info.mock.calls[0][0] as string;      const callArg = consoleSpies.info.mock.calls[0][0] as string;

      expect(callArg).toContain("test message");      expect(callArg).toContain("test message");

    });    });



    it("should log warning message", () => {    it("should log warning message", () => {

      logger.configure({ minLevel: LogLevel.WARN });      logger.configure({ minLevel: LogLevel.WARN });

      logger.warn("test warning");      logger.warn("test warning");



      expect(consoleSpies.warn).toHaveBeenCalled();      expect(consoleSpies.warn).toHaveBeenCalled();

      const callArg = consoleSpies.warn.mock.calls[0][0] as string;      const callArg = consoleSpies.warn.mock.calls[0][0] as string;

      expect(callArg).toContain("test warning");      expect(callArg).toContain("test warning");

    });    });



    it("should log error message", () => {    it("should log error message", () => {

      logger.configure({ minLevel: LogLevel.ERROR });      logger.configure({ minLevel: LogLevel.ERROR });

      logger.error("test error");      logger.error("test error");



      expect(consoleSpies.error).toHaveBeenCalled();      expect(consoleSpies.error).toHaveBeenCalled();

      const callArg = consoleSpies.error.mock.calls[0][0] as string;      const callArg = consoleSpies.error.mock.calls[0][0] as string;

      expect(callArg).toContain("test error");      expect(callArg).toContain("test error");

    });    });



    it("should include category in output", () => {    it("should include category in output", () => {

      logger.configure({ minLevel: LogLevel.DEBUG });      logger.configure({ minLevel: LogLevel.DEBUG });

      logger.debug("test message", {}, LogCategory.DSP);      logger.debug("test message", {}, LogCategory.DSP);



      expect(consoleSpies.debug).toHaveBeenCalled();      expect(consoleSpies.debug).toHaveBeenCalled();

      const callArg = consoleSpies.debug.mock.calls[0][0] as string;      const callArg = consoleSpies.debug.mock.calls[0][0] as string;

      expect(callArg).toContain("DSP");      expect(callArg).toContain("DSP");

    });    });



    it("should include context in output", () => {    it("should include context in output", () => {

      logger.configure({ minLevel: LogLevel.DEBUG });      logger.configure({ minLevel: LogLevel.DEBUG });

      logger.debug("test message", { operation: "FFT", fftSize: 2048 });      logger.debug("test message", { operation: "FFT", fftSize: 2048 });



      expect(consoleSpies.debug).toHaveBeenCalled();      expect(consoleSpies.debug).toHaveBeenCalled();

      // Context should be in second argument      // Context should be in second argument

      expect(consoleSpies.debug.mock.calls[0].length).toBeGreaterThan(1);      expect(consoleSpies.debug.mock.calls[0].length).toBeGreaterThan(1);

    });    });



    it("should handle error objects", () => {    it("should handle error objects", () => {

      logger.configure({ minLevel: LogLevel.ERROR });      logger.configure({ minLevel: LogLevel.ERROR });

      const testError = new Error("test error");      const testError = new Error("test error");

      logger.error("error occurred", testError);      logger.error("error occurred", testError);



      expect(consoleSpies.error).toHaveBeenCalled();      expect(consoleSpies.error).toHaveBeenCalled();

      expect(consoleSpies.error.mock.calls[0].length).toBeGreaterThan(1);      expect(consoleSpies.error.mock.calls[0].length).toBeGreaterThan(1);

    });    });



    it("should filter by enabled categories", () => {    it("should filter by enabled categories", () => {

      logger.configure({      logger.configure({

        minLevel: LogLevel.DEBUG,        minLevel: LogLevel.DEBUG,

        enabledCategories: new Set([LogCategory.DSP]),        enabledCategories: new Set([LogCategory.DSP]),

      });      });



      logger.debug("dsp message", {}, LogCategory.DSP);      logger.debug("dsp message", {}, LogCategory.DSP);

      expect(consoleSpies.debug).toHaveBeenCalled();      expect(consoleSpies.debug).toHaveBeenCalled();



      consoleSpies.debug.mockClear();      consoleSpies.debug.mockClear();

      logger.debug("device message", {}, LogCategory.DEVICE);      logger.debug("device message", {}, LogCategory.DEVICE);

      expect(consoleSpies.debug).not.toHaveBeenCalled();      expect(consoleSpies.debug).not.toHaveBeenCalled();

    });    });



    it("should include timestamp by default", () => {    it("should include timestamp by default", () => {

      logger.configure({ minLevel: LogLevel.DEBUG });      logger.configure({ minLevel: LogLevel.DEBUG });

      logger.debug("test message");      logger.debug("test message");



      expect(consoleSpies.debug).toHaveBeenCalled();      expect(consoleSpies.debug).toHaveBeenCalled();

      const callArg = consoleSpies.debug.mock.calls[0][0] as string;      const callArg = consoleSpies.debug.mock.calls[0][0] as string;

      // Should include ISO timestamp      // Should include ISO timestamp

      expect(callArg).toMatch(/\d{4}-\d{2}-\d{2}T/);      expect(callArg).toMatch(/\d{4}-\d{2}-\d{2}T/);

    });    });



    it("should exclude timestamp when configured", () => {    it("should exclude timestamp when configured", () => {

      logger.configure({ minLevel: LogLevel.DEBUG, includeTimestamp: false });      logger.configure({ minLevel: LogLevel.DEBUG, includeTimestamp: false });

      logger.debug("test message");      logger.debug("test message");



      expect(consoleSpies.debug).toHaveBeenCalled();      expect(consoleSpies.debug).toHaveBeenCalled();

      const callArg = consoleSpies.debug.mock.calls[0][0] as string;      const callArg = consoleSpies.debug.mock.calls[0][0] as string;

      // Should not include timestamp      // Should not include timestamp

      expect(callArg).not.toMatch(/\d{4}-\d{2}-\d{2}T/);      expect(callArg).not.toMatch(/\d{4}-\d{2}-\d{2}T/);

    });    });



    it("should include stack trace when configured", () => {    it("should include stack trace when configured", () => {

      logger.configure({      logger.configure({

        minLevel: LogLevel.ERROR,        minLevel: LogLevel.ERROR,

        includeStackTrace: true,        includeStackTrace: true,

      });      });

      const testError = new Error("test error");      const testError = new Error("test error");

      logger.error("error occurred", testError);      logger.error("error occurred", testError);



      expect(consoleSpies.error).toHaveBeenCalled();      expect(consoleSpies.error).toHaveBeenCalled();

      const contextArg = consoleSpies.error.mock.calls[0][2] as string;      const contextArg = consoleSpies.error.mock.calls[0][2] as string;

      expect(contextArg).toContain("stack");      expect(contextArg).toContain("stack");

    });    });



    it("should handle circular references in context", () => {    it("should handle circular references in context", () => {

      logger.configure({ minLevel: LogLevel.DEBUG });      logger.configure({ minLevel: LogLevel.DEBUG });

      const circular: Record<string, unknown> = {};      const circular: Record<string, unknown> = {};

      circular["self"] = circular;      circular["self"] = circular;



      logger.debug("test", circular);      logger.debug("test", circular);

      expect(consoleSpies.debug).toHaveBeenCalled();      expect(consoleSpies.debug).toHaveBeenCalled();

    });    });



    it("should merge configuration updates", () => {    it("should merge configuration updates", () => {

      logger.configure({ minLevel: LogLevel.WARN });      logger.configure({ minLevel: LogLevel.WARN });

      logger.configure({ includeTimestamp: false });      logger.configure({ includeTimestamp: false });



      logger.warn("test");      logger.warn("test");

      expect(consoleSpies.warn).toHaveBeenCalled();      expect(consoleSpies.warn).toHaveBeenCalled();



      consoleSpies.warn.mockClear();      consoleSpies.warn.mockClear();

      logger.info("should not log");      logger.info("should not log");

      expect(consoleSpies.warn).not.toHaveBeenCalled();      expect(consoleSpies.warn).not.toHaveBeenCalled();

    });    });

  });

    it("should handle non-Error objects in error logs", () => {

      logger.configure({ minLevel: LogLevel.ERROR });  describe("Category-specific loggers", () => {

      logger.error("error occurred", { custom: "error" });    beforeEach(() => {

      logger.configure({ minLevel: LogLevel.DEBUG });

      expect(consoleSpies.error).toHaveBeenCalled();    });

    });

    it("should have device logger with category", () => {

    it("should handle empty context", () => {      deviceLogger.debug("test");

      logger.configure({ minLevel: LogLevel.DEBUG });      expect(consoleSpies.debug).toHaveBeenCalled();

      logger.debug("test", {});      const callArg = consoleSpies.debug.mock.calls[0][0] as string;

      expect(callArg).toContain("DEVICE");

      expect(consoleSpies.debug).toHaveBeenCalled();    });

      // Should only have one argument when context is empty

      const args = consoleSpies.debug.mock.calls[0];    it("should have DSP logger with category", () => {

      expect(args).toHaveLength(1);      dspLogger.debug("test");

    });      expect(consoleSpies.debug).toHaveBeenCalled();

  });      const callArg = consoleSpies.debug.mock.calls[0][0] as string;

      expect(callArg).toContain("DSP");

  describe("Category-specific loggers", () => {    });

    beforeEach(() => {

      logger.configure({ minLevel: LogLevel.DEBUG });    it("should have audio logger with category", () => {

    });      audioLogger.debug("test");

      expect(consoleSpies.debug).toHaveBeenCalled();

    it("should have device logger with category", () => {      const callArg = consoleSpies.debug.mock.calls[0][0] as string;

      deviceLogger.debug("test");      expect(callArg).toContain("AUDIO");

      expect(consoleSpies.debug).toHaveBeenCalled();    });

      const callArg = consoleSpies.debug.mock.calls[0][0] as string;

      expect(callArg).toContain("DEVICE");    it("should have WebGL logger with category", () => {

    });      webglLogger.debug("test");

      expect(consoleSpies.debug).toHaveBeenCalled();

    it("should have DSP logger with category", () => {      const callArg = consoleSpies.debug.mock.calls[0][0] as string;

      dspLogger.debug("test");      expect(callArg).toContain("WEBGL");

      expect(consoleSpies.debug).toHaveBeenCalled();    });

      const callArg = consoleSpies.debug.mock.calls[0][0] as string;

      expect(callArg).toContain("DSP");    it("should have worker logger with category", () => {

    });      workerLogger.debug("test");

      expect(consoleSpies.debug).toHaveBeenCalled();

    it("should have audio logger with category", () => {      const callArg = consoleSpies.debug.mock.calls[0][0] as string;

      audioLogger.debug("test");      expect(callArg).toContain("WORKER");

      expect(consoleSpies.debug).toHaveBeenCalled();    });

      const callArg = consoleSpies.debug.mock.calls[0][0] as string;

      expect(callArg).toContain("AUDIO");    it("should have data flow logger with category", () => {

    });      dataFlowLogger.debug("test");

      expect(consoleSpies.debug).toHaveBeenCalled();

    it("should have WebGL logger with category", () => {      const callArg = consoleSpies.debug.mock.calls[0][0] as string;

      webglLogger.debug("test");      expect(callArg).toContain("DATA");

      expect(consoleSpies.debug).toHaveBeenCalled();    });

      const callArg = consoleSpies.debug.mock.calls[0][0] as string;

      expect(callArg).toContain("WEBGL");    it("should have performance logger with category", () => {

    });      performanceLogger.debug("test");

      expect(consoleSpies.debug).toHaveBeenCalled();

    it("should have worker logger with category", () => {      const callArg = consoleSpies.debug.mock.calls[0][0] as string;

      workerLogger.debug("test");      expect(callArg).toContain("PERF");

      expect(consoleSpies.debug).toHaveBeenCalled();    });

      const callArg = consoleSpies.debug.mock.calls[0][0] as string;

      expect(callArg).toContain("WORKER");    it("should have recovery logger with category", () => {

    });      recoveryLogger.debug("test");

      expect(consoleSpies.debug).toHaveBeenCalled();

    it("should have data flow logger with category", () => {      const callArg = consoleSpies.debug.mock.calls[0][0] as string;

      dataFlowLogger.debug("test");      expect(callArg).toContain("RECOVERY");

      expect(consoleSpies.debug).toHaveBeenCalled();    });

      const callArg = consoleSpies.debug.mock.calls[0][0] as string;

      expect(callArg).toContain("DATA");    it("should have user action logger with category", () => {

    });      userActionLogger.debug("test");

      expect(consoleSpies.debug).toHaveBeenCalled();

    it("should have performance logger with category", () => {      const callArg = consoleSpies.debug.mock.calls[0][0] as string;

      performanceLogger.debug("test");      expect(callArg).toContain("USER");

      expect(consoleSpies.debug).toHaveBeenCalled();    });

      const callArg = consoleSpies.debug.mock.calls[0][0] as string;

      expect(callArg).toContain("PERF");    it("should have USB logger with category", () => {

    });      usbLogger.debug("test");

      expect(consoleSpies.debug).toHaveBeenCalled();

    it("should have recovery logger with category", () => {      const callArg = consoleSpies.debug.mock.calls[0][0] as string;

      recoveryLogger.debug("test");      expect(callArg).toContain("USB");

      expect(consoleSpies.debug).toHaveBeenCalled();    });

      const callArg = consoleSpies.debug.mock.calls[0][0] as string;

      expect(callArg).toContain("RECOVERY");    it("should support all log levels", () => {

    });      logger.configure({ minLevel: LogLevel.DEBUG });



    it("should have user action logger with category", () => {      dspLogger.debug("debug");

      userActionLogger.debug("test");      dspLogger.info("info");

      expect(consoleSpies.debug).toHaveBeenCalled();      dspLogger.warn("warn");

      const callArg = consoleSpies.debug.mock.calls[0][0] as string;      dspLogger.error("error");

      expect(callArg).toContain("USER");

    });      expect(consoleSpies.debug).toHaveBeenCalled();

      expect(consoleSpies.info).toHaveBeenCalled();

    it("should have USB logger with category", () => {      expect(consoleSpies.warn).toHaveBeenCalled();

      usbLogger.debug("test");      expect(consoleSpies.error).toHaveBeenCalled();

      expect(consoleSpies.debug).toHaveBeenCalled();    });

      const callArg = consoleSpies.debug.mock.calls[0][0] as string;

      expect(callArg).toContain("USB");    it("should pass through context", () => {

    });      dspLogger.debug("test", { fftSize: 2048 });

      expect(consoleSpies.debug).toHaveBeenCalled();

    it("should support all log levels", () => {      expect(consoleSpies.debug.mock.calls[0].length).toBeGreaterThan(1);

      logger.configure({ minLevel: LogLevel.DEBUG });    });



      dspLogger.debug("debug");    it("should handle errors with context", () => {

      dspLogger.info("info");      const error = new Error("test error");

      dspLogger.warn("warn");      deviceLogger.error("failed", error, { deviceId: "123" });

      dspLogger.error("error");      expect(consoleSpies.error).toHaveBeenCalled();

    });

      expect(consoleSpies.debug).toHaveBeenCalled();  });

      expect(consoleSpies.info).toHaveBeenCalled();

      expect(consoleSpies.warn).toHaveBeenCalled();  describe("OperationLogger", () => {

      expect(consoleSpies.error).toHaveBeenCalled();    beforeEach(() => {

    });      logger.configure({ minLevel: LogLevel.DEBUG });

    });

    it("should pass through context", () => {

      dspLogger.debug("test", { fftSize: 2048 });    it("should log operation start", () => {

      expect(consoleSpies.debug).toHaveBeenCalled();      new OperationLogger(dspLogger, "TestOperation");

      expect(consoleSpies.debug.mock.calls[0].length).toBeGreaterThan(1);

    });      expect(consoleSpies.debug).toHaveBeenCalled();

      const callArg = consoleSpies.debug.mock.calls[0][0] as string;

    it("should handle errors with context", () => {      expect(callArg).toContain("TestOperation started");

      const error = new Error("test error");    });

      deviceLogger.error("failed", error, { deviceId: "123" });

      expect(consoleSpies.error).toHaveBeenCalled();    it("should log operation success with duration", () => {

    });      const opLog = new OperationLogger(dspLogger, "TestOperation");

  });

      consoleSpies.info.mockClear();

  describe("OperationLogger", () => {      opLog.success();

    beforeEach(() => {

      logger.configure({ minLevel: LogLevel.DEBUG });      expect(consoleSpies.info).toHaveBeenCalled();

    });      const contextArg = consoleSpies.info.mock.calls[0][2] as string;

      expect(contextArg).toContain("durationMs");

    it("should log operation start", () => {    });

      new OperationLogger(dspLogger, "TestOperation");

    it("should log operation failure with error", () => {

      expect(consoleSpies.debug).toHaveBeenCalled();      const opLog = new OperationLogger(dspLogger, "TestOperation");

      const callArg = consoleSpies.debug.mock.calls[0][0] as string;

      expect(callArg).toContain("TestOperation started");      consoleSpies.error.mockClear();

    });      const error = new Error("operation failed");

      opLog.failure(error);

    it("should log operation success with duration", () => {

      const opLog = new OperationLogger(dspLogger, "TestOperation");      expect(consoleSpies.error).toHaveBeenCalled();

      const callArg = consoleSpies.error.mock.calls[0][0] as string;

      consoleSpies.info.mockClear();      expect(callArg).toContain("TestOperation failed");

      opLog.success();    });



      expect(consoleSpies.info).toHaveBeenCalled();    it("should log operation warning", () => {

      const contextArg = consoleSpies.info.mock.calls[0][2] as string;      const opLog = new OperationLogger(dspLogger, "TestOperation");

      expect(contextArg).toContain("durationMs");

    });      consoleSpies.warn.mockClear();

      opLog.warn("partial success");

    it("should log operation failure with error", () => {

      const opLog = new OperationLogger(dspLogger, "TestOperation");      expect(consoleSpies.warn).toHaveBeenCalled();

      const callArg = consoleSpies.warn.mock.calls[0][0] as string;

      consoleSpies.error.mockClear();      expect(callArg).toContain("partial success");

      const error = new Error("operation failed");    });

      opLog.failure(error);

    it("should track elapsed time in warnings", () => {

      expect(consoleSpies.error).toHaveBeenCalled();      const opLog = new OperationLogger(dspLogger, "TestOperation");

      const callArg = consoleSpies.error.mock.calls[0][0] as string;

      expect(callArg).toContain("TestOperation failed");      opLog.warn("slow operation");

    });

      expect(consoleSpies.warn).toHaveBeenCalled();

    it("should log operation warning", () => {      const contextArg = consoleSpies.warn.mock.calls[0][2] as string;

      const opLog = new OperationLogger(dspLogger, "TestOperation");      expect(contextArg).toContain("elapsedMs");

    });

      consoleSpies.warn.mockClear();

      opLog.warn("partial success");    it("should accept start context", () => {

      new OperationLogger(dspLogger, "TestOperation", { requestId: "123" });

      expect(consoleSpies.warn).toHaveBeenCalled();

      const callArg = consoleSpies.warn.mock.calls[0][0] as string;      expect(consoleSpies.debug).toHaveBeenCalled();

      expect(callArg).toContain("partial success");      expect(consoleSpies.debug.mock.calls[0].length).toBeGreaterThan(1);

    });    });



    it("should track elapsed time in warnings", () => {    it("should merge end context with duration", () => {

      const opLog = new OperationLogger(dspLogger, "TestOperation");      const opLog = new OperationLogger(dspLogger, "TestOperation");



      opLog.warn("slow operation");      opLog.success({ itemsProcessed: 100 });



      expect(consoleSpies.warn).toHaveBeenCalled();      expect(consoleSpies.info).toHaveBeenCalled();

      const contextArg = consoleSpies.warn.mock.calls[0][2] as string;      const contextArg = consoleSpies.info.mock.calls[0][2] as string;

      expect(contextArg).toContain("elapsedMs");      expect(contextArg).toContain("durationMs");

    });      expect(contextArg).toContain("itemsProcessed");

    });

    it("should accept start context", () => {  });

      new OperationLogger(dspLogger, "TestOperation", { requestId: "123" });

  describe("createOperationLogger", () => {

      expect(consoleSpies.debug).toHaveBeenCalled();    beforeEach(() => {

      expect(consoleSpies.debug.mock.calls[0].length).toBeGreaterThan(1);      logger.configure({ minLevel: LogLevel.DEBUG });

    });    });



    it("should merge end context with duration", () => {    it("should create operation logger", () => {

      const opLog = new OperationLogger(dspLogger, "TestOperation");      const opLog = createOperationLogger(deviceLogger, "DeviceOperation");



      opLog.success({ itemsProcessed: 100 });      expect(opLog).toBeInstanceOf(OperationLogger);

      expect(consoleSpies.debug).toHaveBeenCalled();

      expect(consoleSpies.info).toHaveBeenCalled();    });

      const contextArg = consoleSpies.info.mock.calls[0][2] as string;

      expect(contextArg).toContain("durationMs");    it("should support start context", () => {

      expect(contextArg).toContain("itemsProcessed");      createOperationLogger(deviceLogger, "DeviceOperation", {

    });        deviceId: "ABC123",

  });      });



  describe("createOperationLogger", () => {      expect(consoleSpies.debug).toHaveBeenCalled();

    beforeEach(() => {      expect(consoleSpies.debug.mock.calls[0].length).toBeGreaterThan(1);

      logger.configure({ minLevel: LogLevel.DEBUG });    });

    });

    it("should work with different category loggers", () => {

    it("should create operation logger", () => {      createOperationLogger(audioLogger, "AudioOperation");

      const opLog = createOperationLogger(deviceLogger, "DeviceOperation");

      expect(consoleSpies.debug).toHaveBeenCalled();

      expect(opLog).toBeInstanceOf(OperationLogger);      const callArg = consoleSpies.debug.mock.calls[0][0] as string;

      expect(consoleSpies.debug).toHaveBeenCalled();      expect(callArg).toContain("AUDIO");

    });    });

  });

    it("should support start context", () => {

      createOperationLogger(deviceLogger, "DeviceOperation", {  describe("forCategory", () => {

        deviceId: "ABC123",    beforeEach(() => {

      });      logger.configure({ minLevel: LogLevel.DEBUG });

    });

      expect(consoleSpies.debug).toHaveBeenCalled();

      expect(consoleSpies.debug.mock.calls[0].length).toBeGreaterThan(1);    it("should create category logger", () => {

    });      const categoryLogger = logger.forCategory(LogCategory.DSP);



    it("should work with different category loggers", () => {      categoryLogger.debug("test");

      createOperationLogger(audioLogger, "AudioOperation");

      expect(consoleSpies.debug).toHaveBeenCalled();

      expect(consoleSpies.debug).toHaveBeenCalled();      const callArg = consoleSpies.debug.mock.calls[0][0] as string;

      const callArg = consoleSpies.debug.mock.calls[0][0] as string;      expect(callArg).toContain("DSP");

      expect(callArg).toContain("AUDIO");    });

    });

  });    it("should support all log levels", () => {

      const categoryLogger = logger.forCategory(LogCategory.PERFORMANCE);

  describe("forCategory", () => {

    beforeEach(() => {      categoryLogger.debug("debug");

      logger.configure({ minLevel: LogLevel.DEBUG });      categoryLogger.info("info");

    });      categoryLogger.warn("warn");

      categoryLogger.error("error");

    it("should create category logger", () => {

      const categoryLogger = logger.forCategory(LogCategory.DSP);      expect(consoleSpies.debug).toHaveBeenCalled();

      expect(consoleSpies.info).toHaveBeenCalled();

      categoryLogger.debug("test");      expect(consoleSpies.warn).toHaveBeenCalled();

      expect(consoleSpies.error).toHaveBeenCalled();

      expect(consoleSpies.debug).toHaveBeenCalled();    });

      const callArg = consoleSpies.debug.mock.calls[0][0] as string;  });

      expect(callArg).toContain("DSP");

    });  describe("Log levels", () => {

    it("should have correct log level hierarchy", () => {

    it("should support all log levels", () => {      expect(LogLevel.DEBUG).toBeLessThan(LogLevel.INFO);

      const categoryLogger = logger.forCategory(LogCategory.PERFORMANCE);      expect(LogLevel.INFO).toBeLessThan(LogLevel.WARN);

      expect(LogLevel.WARN).toBeLessThan(LogLevel.ERROR);

      categoryLogger.debug("debug");      expect(LogLevel.ERROR).toBeLessThan(LogLevel.NONE);

      categoryLogger.info("info");    });

      categoryLogger.warn("warn");

      categoryLogger.error("error");    it("should respect NONE level", () => {

      logger.configure({ minLevel: LogLevel.NONE });

      expect(consoleSpies.debug).toHaveBeenCalled();

      expect(consoleSpies.info).toHaveBeenCalled();      logger.error("should not log");

      expect(consoleSpies.warn).toHaveBeenCalled();      logger.warn("should not log");

      expect(consoleSpies.error).toHaveBeenCalled();      logger.info("should not log");

    });      logger.debug("should not log");

  });

      expect(consoleSpies.error).not.toHaveBeenCalled();

  describe("Log levels", () => {      expect(consoleSpies.warn).not.toHaveBeenCalled();

    it("should have correct log level hierarchy", () => {      expect(consoleSpies.info).not.toHaveBeenCalled();

      expect(LogLevel.DEBUG).toBeLessThan(LogLevel.INFO);      expect(consoleSpies.debug).not.toHaveBeenCalled();

      expect(LogLevel.INFO).toBeLessThan(LogLevel.WARN);    });

      expect(LogLevel.WARN).toBeLessThan(LogLevel.ERROR);  });

      expect(LogLevel.ERROR).toBeLessThan(LogLevel.NONE);

    });  describe("Log categories", () => {

    it("should have all expected categories", () => {

    it("should respect NONE level", () => {      expect(LogCategory.DEVICE).toBeDefined();

      logger.configure({ minLevel: LogLevel.NONE });      expect(LogCategory.DATA_FLOW).toBeDefined();

      expect(LogCategory.WEBGL).toBeDefined();

      logger.error("should not log");      expect(LogCategory.AUDIO).toBeDefined();

      logger.warn("should not log");      expect(LogCategory.DSP).toBeDefined();

      logger.info("should not log");      expect(LogCategory.PERFORMANCE).toBeDefined();

      logger.debug("should not log");      expect(LogCategory.USB).toBeDefined();

      expect(LogCategory.RECOVERY).toBeDefined();

      expect(consoleSpies.error).not.toHaveBeenCalled();      expect(LogCategory.WORKER).toBeDefined();

      expect(consoleSpies.warn).not.toHaveBeenCalled();      expect(LogCategory.USER_ACTION).toBeDefined();

      expect(consoleSpies.info).not.toHaveBeenCalled();    });

      expect(consoleSpies.debug).not.toHaveBeenCalled();

    });    it("should have emoji prefixes for visual distinction", () => {

  });      expect(LogCategory.DEVICE).toContain("🔌");

      expect(LogCategory.DSP).toContain("📡");

  describe("Log categories", () => {      expect(LogCategory.AUDIO).toContain("🔊");

    it("should have all expected categories", () => {      expect(LogCategory.WEBGL).toContain("🎨");

      expect(LogCategory.DEVICE).toBeDefined();      expect(LogCategory.PERFORMANCE).toContain("⚡");

      expect(LogCategory.DATA_FLOW).toBeDefined();    });

      expect(LogCategory.WEBGL).toBeDefined();  });

      expect(LogCategory.AUDIO).toBeDefined();});

      expect(LogCategory.DSP).toBeDefined();

      expect(LogCategory.PERFORMANCE).toBeDefined();

      expect(LogCategory.USB).toBeDefined();  describe("Logger class", () => {

      expect(LogCategory.RECOVERY).toBeDefined();    describe("constructor", () => {

      expect(LogCategory.WORKER).toBeDefined();      it("should create logger with default config", () => {

      expect(LogCategory.USER_ACTION).toBeDefined();        const log = new Logger();

    });        expect(log.config.level).toBe(LogLevel.INFO);

        expect(log.config.enabledCategories).toBeUndefined();

    it("should have emoji prefixes for visual distinction", () => {      });

      expect(LogCategory.DEVICE).toContain("🔌");

      expect(LogCategory.DSP).toContain("📡");      it("should create logger with custom config", () => {

      expect(LogCategory.AUDIO).toContain("🔊");        const log = new Logger({

      expect(LogCategory.WEBGL).toContain("🎨");          level: LogLevel.DEBUG,

      expect(LogCategory.PERFORMANCE).toContain("⚡");          enabledCategories: [LogCategory.DSP],

    });        });

  });        expect(log.config.level).toBe(LogLevel.DEBUG);

});        expect(log.config.enabledCategories).toEqual([LogCategory.DSP]);

      });
    });

    describe("configure", () => {
      it("should update logger configuration", () => {
        const log = new Logger();
        log.configure({ level: LogLevel.ERROR });
        expect(log.config.level).toBe(LogLevel.ERROR);
      });

      it("should merge configuration", () => {
        const log = new Logger({ level: LogLevel.INFO });
        log.configure({ enabledCategories: [LogCategory.DEVICE] });
        expect(log.config.level).toBe(LogLevel.INFO);
        expect(log.config.enabledCategories).toEqual([LogCategory.DEVICE]);
      });
    });

    describe("shouldLog", () => {
      it("should respect log level threshold", () => {
        const log = new Logger({ level: LogLevel.WARN });
        
        expect(log["shouldLog"](LogLevel.DEBUG)).toBe(false);
        expect(log["shouldLog"](LogLevel.INFO)).toBe(false);
        expect(log["shouldLog"](LogLevel.WARN)).toBe(true);
        expect(log["shouldLog"](LogLevel.ERROR)).toBe(true);
      });

      it("should allow all categories when none are specified", () => {
        const log = new Logger({ level: LogLevel.DEBUG });
        
        expect(
          log["shouldLog"](LogLevel.DEBUG, LogCategory.DSP),
        ).toBe(true);
        expect(
          log["shouldLog"](LogLevel.DEBUG, LogCategory.DEVICE),
        ).toBe(true);
      });

      it("should filter by enabled categories", () => {
        const log = new Logger({
          level: LogLevel.DEBUG,
          enabledCategories: [LogCategory.DSP, LogCategory.AUDIO],
        });
        
        expect(
          log["shouldLog"](LogLevel.DEBUG, LogCategory.DSP),
        ).toBe(true);
        expect(
          log["shouldLog"](LogLevel.DEBUG, LogCategory.AUDIO),
        ).toBe(true);
        expect(
          log["shouldLog"](LogLevel.DEBUG, LogCategory.DEVICE),
        ).toBe(false);
      });

      it("should log errors regardless of category filters", () => {
        const log = new Logger({
          level: LogLevel.ERROR,
          enabledCategories: [LogCategory.DSP],
        });
        
        expect(
          log["shouldLog"](LogLevel.ERROR, LogCategory.DEVICE),
        ).toBe(true);
      });
    });

    describe("debug", () => {
      it("should log debug message when level allows", () => {
        const log = new Logger({ level: LogLevel.DEBUG });
        log.debug("test message");
        
        expect(consoleSpies.debug).toHaveBeenCalledWith(
          expect.stringContaining("[DEBUG]"),
          expect.stringContaining("test message"),
        );
      });

      it("should not log debug when level is higher", () => {
        const log = new Logger({ level: LogLevel.INFO });
        log.debug("test message");
        
        expect(consoleSpies.debug).not.toHaveBeenCalled();
      });

      it("should include category in output", () => {
        const log = new Logger({ level: LogLevel.DEBUG });
        log.debug("test message", { category: LogCategory.DSP });
        
        expect(consoleSpies.debug).toHaveBeenCalledWith(
          expect.stringContaining("[DSP]"),
          expect.stringContaining("test message"),
        );
      });

      it("should include context in output", () => {
        const log = new Logger({ level: LogLevel.DEBUG });
        log.debug("test message", { 
          category: LogCategory.DSP, 
          operation: "FFT",
        });
        
        expect(consoleSpies.debug).toHaveBeenCalledWith(
          expect.stringContaining("operation=FFT"),
          expect.stringContaining("test message"),
        );
      });
    });

    describe("info", () => {
      it("should log info message", () => {
        const log = new Logger({ level: LogLevel.INFO });
        log.info("test message");
        
        expect(consoleSpies.log).toHaveBeenCalledWith(
          expect.stringContaining("[INFO]"),
          expect.stringContaining("test message"),
        );
      });

      it("should not log info when level is higher", () => {
        const log = new Logger({ level: LogLevel.WARN });
        log.info("test message");
        
        expect(consoleSpies.log).not.toHaveBeenCalled();
      });
    });

    describe("warn", () => {
      it("should log warning message", () => {
        const log = new Logger({ level: LogLevel.WARN });
        log.warn("test warning");
        
        expect(consoleSpies.warn).toHaveBeenCalledWith(
          expect.stringContaining("[WARN]"),
          expect.stringContaining("test warning"),
        );
      });

      it("should not log warn when level is higher", () => {
        const log = new Logger({ level: LogLevel.ERROR });
        log.warn("test warning");
        
        expect(consoleSpies.warn).not.toHaveBeenCalled();
      });
    });

    describe("error", () => {
      it("should log error message", () => {
        const log = new Logger({ level: LogLevel.ERROR });
        log.error("test error");
        
        expect(consoleSpies.error).toHaveBeenCalledWith(
          expect.stringContaining("[ERROR]"),
          expect.stringContaining("test error"),
        );
      });

      it("should include error object in output", () => {
        const log = new Logger({ level: LogLevel.ERROR });
        const testError = new Error("test error");
        log.error("error occurred", { error: testError });
        
        expect(consoleSpies.error).toHaveBeenCalledWith(
          expect.stringContaining("[ERROR]"),
          expect.stringContaining("error occurred"),
          expect.stringContaining("test error"),
        );
      });

      it("should include stack trace", () => {
        const log = new Logger({ level: LogLevel.ERROR });
        const testError = new Error("test error");
        log.error("error occurred", { error: testError });
        
        expect(consoleSpies.error).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(String),
          expect.stringContaining("Stack:"),
        );
      });

      it("should handle non-Error objects", () => {
        const log = new Logger({ level: LogLevel.ERROR });
        log.error("error occurred", { error: { message: "custom error" } });
        
        expect(consoleSpies.error).toHaveBeenCalledWith(
          expect.stringContaining("[ERROR]"),
          expect.stringContaining("error occurred"),
          expect.stringContaining("custom error"),
        );
      });
    });

    describe("forCategory", () => {
      it("should create category logger", () => {
        const log = new Logger({ level: LogLevel.DEBUG });
        const categoryLog = log.forCategory(LogCategory.DSP);
        
        expect(categoryLog).toBeInstanceOf(CategoryLogger);
        categoryLog.debug("test");
        
        expect(consoleSpies.debug).toHaveBeenCalledWith(
          expect.stringContaining("[DSP]"),
          expect.stringContaining("test"),
        );
      });
    });
  });

  describe("CategoryLogger", () => {
    it("should wrap logger with category", () => {
      const log = new Logger({ level: LogLevel.DEBUG });
      const categoryLog = new CategoryLogger(log, LogCategory.DEVICE);
      
      categoryLog.debug("test message");
      
      expect(consoleSpies.debug).toHaveBeenCalledWith(
        expect.stringContaining("[DEVICE]"),
        expect.stringContaining("test message"),
      );
    });

    it("should pass through all log levels", () => {
      const log = new Logger({ level: LogLevel.DEBUG });
      const categoryLog = new CategoryLogger(log, LogCategory.AUDIO);
      
      categoryLog.debug("debug");
      categoryLog.info("info");
      categoryLog.warn("warn");
      categoryLog.error("error");
      
      expect(consoleSpies.debug).toHaveBeenCalled();
      expect(consoleSpies.log).toHaveBeenCalled();
      expect(consoleSpies.warn).toHaveBeenCalled();
      expect(consoleSpies.error).toHaveBeenCalled();
    });

    it("should merge context with category", () => {
      const log = new Logger({ level: LogLevel.DEBUG });
      const categoryLog = new CategoryLogger(log, LogCategory.PERFORMANCE);
      
      categoryLog.debug("test", { operation: "measure" });
      
      expect(consoleSpies.debug).toHaveBeenCalledWith(
        expect.stringContaining("[PERFORMANCE]"),
        expect.stringContaining("operation=measure"),
      );
    });
  });

  describe("OperationLogger", () => {
    it("should track operation lifecycle", () => {
      const log = new Logger({ level: LogLevel.DEBUG });
      const opLog = new OperationLogger(log, "TestOp", LogCategory.DSP);
      
      expect(consoleSpies.debug).toHaveBeenCalledWith(
        expect.stringContaining("TestOp started"),
        expect.any(String),
      );
    });

    it("should log success on complete", () => {
      const log = new Logger({ level: LogLevel.INFO });
      const opLog = new OperationLogger(log, "TestOp", LogCategory.DSP);
      
      consoleSpies.log.mockClear();
      opLog.complete();
      
      expect(consoleSpies.log).toHaveBeenCalledWith(
        expect.stringContaining("TestOp completed"),
        expect.stringContaining("duration"),
      );
    });

    it("should log warning on complete with warning message", () => {
      const log = new Logger({ level: LogLevel.WARN });
      const opLog = new OperationLogger(log, "TestOp", LogCategory.DSP);
      
      consoleSpies.warn.mockClear();
      opLog.complete("partial success");
      
      expect(consoleSpies.warn).toHaveBeenCalledWith(
        expect.stringContaining("TestOp completed"),
        expect.stringContaining("partial success"),
      );
    });

    it("should log error on fail", () => {
      const log = new Logger({ level: LogLevel.ERROR });
      const opLog = new OperationLogger(log, "TestOp", LogCategory.DSP);
      
      consoleSpies.error.mockClear();
      const error = new Error("operation failed");
      opLog.fail(error);
      
      expect(consoleSpies.error).toHaveBeenCalledWith(
        expect.stringContaining("TestOp failed"),
        expect.stringContaining("operation failed"),
      );
    });

    it("should calculate operation duration", () => {
      const log = new Logger({ level: LogLevel.INFO });
      const opLog = new OperationLogger(log, "TestOp", LogCategory.DSP);
      
      consoleSpies.log.mockClear();
      opLog.complete();
      
      expect(consoleSpies.log).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringMatching(/duration=\d+ms/),
      );
    });

    it("should allow custom context", () => {
      const log = new Logger({ level: LogLevel.DEBUG });
      const opLog = new OperationLogger(log, "TestOp", LogCategory.DSP, {
        customKey: "customValue",
      });
      
      expect(consoleSpies.debug).toHaveBeenCalledWith(
        expect.stringContaining("customKey=customValue"),
        expect.any(String),
      );
    });
  });

  describe("createOperationLogger", () => {
    it("should create operation logger with default logger", () => {
      logger.configure({ level: LogLevel.DEBUG });
      const opLog = createOperationLogger("TestOp", LogCategory.DEVICE);
      
      expect(consoleSpies.debug).toHaveBeenCalledWith(
        expect.stringContaining("TestOp started"),
        expect.any(String),
      );
    });

    it("should support optional context", () => {
      logger.configure({ level: LogLevel.DEBUG });
      const opLog = createOperationLogger("TestOp", LogCategory.DEVICE, {
        deviceId: "123",
      });
      
      expect(consoleSpies.debug).toHaveBeenCalledWith(
        expect.stringContaining("deviceId=123"),
        expect.any(String),
      );
    });
  });

  describe("Global logger instance", () => {
    it("should have global logger", () => {
      expect(logger).toBeInstanceOf(Logger);
    });

    it("should allow configuration of global logger", () => {
      logger.configure({ level: LogLevel.ERROR });
      logger.info("should not log");
      
      expect(consoleSpies.log).not.toHaveBeenCalled();
      
      logger.error("should log");
      expect(consoleSpies.error).toHaveBeenCalled();
    });
  });

  describe("Category-specific loggers", () => {
    beforeEach(() => {
      logger.configure({ level: LogLevel.DEBUG });
    });

    it("should have device logger", () => {
      deviceLogger.debug("test");
      expect(consoleSpies.debug).toHaveBeenCalledWith(
        expect.stringContaining("[DEVICE]"),
        expect.any(String),
      );
    });

    it("should have DSP logger", () => {
      dspLogger.debug("test");
      expect(consoleSpies.debug).toHaveBeenCalledWith(
        expect.stringContaining("[DSP]"),
        expect.any(String),
      );
    });

    it("should have audio logger", () => {
      audioLogger.debug("test");
      expect(consoleSpies.debug).toHaveBeenCalledWith(
        expect.stringContaining("[AUDIO]"),
        expect.any(String),
      );
    });

    it("should have WebGL logger", () => {
      webglLogger.debug("test");
      expect(consoleSpies.debug).toHaveBeenCalledWith(
        expect.stringContaining("[WEBGL]"),
        expect.any(String),
      );
    });

    it("should have worker logger", () => {
      workerLogger.debug("test");
      expect(consoleSpies.debug).toHaveBeenCalledWith(
        expect.stringContaining("[WORKER]"),
        expect.any(String),
      );
    });

    it("should have data flow logger", () => {
      dataFlowLogger.debug("test");
      expect(consoleSpies.debug).toHaveBeenCalledWith(
        expect.stringContaining("[DATA_FLOW]"),
        expect.any(String),
      );
    });

    it("should have performance logger", () => {
      performanceLogger.debug("test");
      expect(consoleSpies.debug).toHaveBeenCalledWith(
        expect.stringContaining("[PERFORMANCE]"),
        expect.any(String),
      );
    });

    it("should have recovery logger", () => {
      recoveryLogger.debug("test");
      expect(consoleSpies.debug).toHaveBeenCalledWith(
        expect.stringContaining("[RECOVERY]"),
        expect.any(String),
      );
    });

    it("should have user action logger", () => {
      userActionLogger.debug("test");
      expect(consoleSpies.debug).toHaveBeenCalledWith(
        expect.stringContaining("[USER_ACTION]"),
        expect.any(String),
      );
    });

    it("should have USB logger", () => {
      usbLogger.debug("test");
      expect(consoleSpies.debug).toHaveBeenCalledWith(
        expect.stringContaining("[USB]"),
        expect.any(String),
      );
    });
  });

  describe("formatMessage", () => {
    it("should format timestamp", () => {
      const log = new Logger({ level: LogLevel.DEBUG });
      log.debug("test");
      
      expect(consoleSpies.debug).toHaveBeenCalledWith(
        expect.stringMatching(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
        expect.any(String),
      );
    });

    it("should format with category", () => {
      const log = new Logger({ level: LogLevel.DEBUG });
      log.debug("test", { category: LogCategory.DSP });
      
      expect(consoleSpies.debug).toHaveBeenCalledWith(
        expect.stringContaining("[DSP]"),
        expect.any(String),
      );
    });

    it("should format context", () => {
      const log = new Logger({ level: LogLevel.DEBUG });
      log.debug("test", { 
        category: LogCategory.DSP,
        operation: "FFT",
        fftSize: 2048,
      });
      
      expect(consoleSpies.debug).toHaveBeenCalledWith(
        expect.stringContaining("operation=FFT"),
        expect.stringContaining("fftSize=2048"),
      );
    });
  });
});
