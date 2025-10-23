/**
 * Centralized logging utility for rad.io
 * Provides structured logging with consistent context and level management
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

export enum LogCategory {
  DEVICE = "🔌 DEVICE",
  DATA_FLOW = "📊 DATA",
  WEBGL = "🎨 WEBGL",
  AUDIO = "🔊 AUDIO",
  DSP = "📡 DSP",
  PERFORMANCE = "⚡ PERF",
  USB = "🔗 USB",
  RECOVERY = "🔄 RECOVERY",
  WORKER = "⚙️ WORKER",
  USER_ACTION = "👆 USER",
}

interface LogContext {
  [key: string]: unknown;
}

interface LoggerConfig {
  minLevel: LogLevel;
  enabledCategories?: Set<LogCategory>;
  includeTimestamp?: boolean;
  includeStackTrace?: boolean;
}

class Logger {
  private config: LoggerConfig;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      minLevel:
        process.env['NODE_ENV'] === "development" ? LogLevel.DEBUG : LogLevel.INFO,
      enabledCategories: undefined, // undefined means all enabled
      includeTimestamp: true,
      includeStackTrace: false,
      ...config,
    };
  }

  /**
   * Update logger configuration at runtime
   */
  configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Check if a log should be emitted based on level and category
   */
  private shouldLog(level: LogLevel, category?: LogCategory): boolean {
    if (level < this.config.minLevel) {
      return false;
    }

    if (
      category &&
      this.config.enabledCategories &&
      !this.config.enabledCategories.has(category)
    ) {
      return false;
    }

    return true;
  }

  /**
   * Format log message with category and timestamp
   */
  private formatMessage(
    category: LogCategory | undefined,
    message: string,
  ): string {
    const parts: string[] = [];

    if (this.config.includeTimestamp) {
      const timestamp = new Date().toISOString();
      parts.push(`[${timestamp}]`);
    }

    if (category) {
      parts.push(category);
    }

    parts.push(message);

    return parts.join(" ");
  }

  /**
   * Format context object for logging
   */
  private formatContext(context?: LogContext): string {
    if (!context || Object.keys(context).length === 0) {
      return "";
    }

    try {
      return JSON.stringify(context, null, 2);
    } catch (error) {
      return `[Circular/Complex object: ${String(error)}]`;
    }
  }

  /**
   * Log a debug message (development only)
   */
  debug(message: string, context?: LogContext, category?: LogCategory): void {
    if (!this.shouldLog(LogLevel.DEBUG, category)) {
      return;
    }

    const formattedMessage = this.formatMessage(category, message);
    const formattedContext = this.formatContext(context);

    if (formattedContext) {
      console.debug(formattedMessage, "\n", formattedContext);
    } else {
      console.debug(formattedMessage);
    }
  }

  /**
   * Log an informational message
   */
  info(message: string, context?: LogContext, category?: LogCategory): void {
    if (!this.shouldLog(LogLevel.INFO, category)) {
      return;
    }

    const formattedMessage = this.formatMessage(category, message);
    const formattedContext = this.formatContext(context);

    if (formattedContext) {
      console.info(formattedMessage, "\n", formattedContext);
    } else {
      console.info(formattedMessage);
    }
  }

  /**
   * Log a warning message
   */
  warn(message: string, context?: LogContext, category?: LogCategory): void {
    if (!this.shouldLog(LogLevel.WARN, category)) {
      return;
    }

    const formattedMessage = this.formatMessage(category, message);
    const formattedContext = this.formatContext(context);

    if (formattedContext) {
      console.warn(formattedMessage, "\n", formattedContext);
    } else {
      console.warn(formattedMessage);
    }
  }

  /**
   * Log an error message with optional error object
   */
  error(
    message: string,
    error?: Error | unknown,
    context?: LogContext,
    category?: LogCategory,
  ): void {
    if (!this.shouldLog(LogLevel.ERROR, category)) {
      return;
    }

    const formattedMessage = this.formatMessage(category, message);
    const errorDetails =
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack: this.config.includeStackTrace ? error.stack : undefined,
          }
        : { error: String(error) };

    const fullContext = { ...context, ...errorDetails };
    const formattedContext = this.formatContext(fullContext);

    if (formattedContext) {
      console.error(formattedMessage, "\n", formattedContext);
    } else {
      console.error(formattedMessage);
    }
  }

  /**
   * Create a child logger with a specific category
   */
  forCategory(category: LogCategory): CategoryLogger {
    return new CategoryLogger(this, category);
  }
}

/**
 * Category-specific logger that automatically applies a category to all logs
 */
class CategoryLogger {
  constructor(
    private parent: Logger,
    private category: LogCategory,
  ) {}

  debug(message: string, context?: LogContext): void {
    this.parent.debug(message, context, this.category);
  }

  info(message: string, context?: LogContext): void {
    this.parent.info(message, context, this.category);
  }

  warn(message: string, context?: LogContext): void {
    this.parent.warn(message, context, this.category);
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    this.parent.error(message, error, context, this.category);
  }
}

// Export singleton instance
export const logger = new Logger();

// Export category-specific loggers for common use cases
export const deviceLogger = logger.forCategory(LogCategory.DEVICE);
export const dataFlowLogger = logger.forCategory(LogCategory.DATA_FLOW);
export const webglLogger = logger.forCategory(LogCategory.WEBGL);
export const audioLogger = logger.forCategory(LogCategory.AUDIO);
export const dspLogger = logger.forCategory(LogCategory.DSP);
export const performanceLogger = logger.forCategory(LogCategory.PERFORMANCE);
export const usbLogger = logger.forCategory(LogCategory.USB);
export const recoveryLogger = logger.forCategory(LogCategory.RECOVERY);
export const workerLogger = logger.forCategory(LogCategory.WORKER);
export const userActionLogger = logger.forCategory(LogCategory.USER_ACTION);

/**
 * Utility to create operation-scoped loggers that track duration
 */
export class OperationLogger {
  private startTime: number;

  constructor(
    private categoryLogger: CategoryLogger,
    private operationName: string,
    startContext?: LogContext,
  ) {
    this.startTime = performance.now();
    this.categoryLogger.debug(`${operationName} started`, startContext);
  }

  success(endContext?: LogContext): void {
    const duration = performance.now() - this.startTime;
    this.categoryLogger.info(`${this.operationName} completed`, {
      ...endContext,
      durationMs: duration.toFixed(2),
    });
  }

  failure(error: Error | unknown, endContext?: LogContext): void {
    const duration = performance.now() - this.startTime;
    this.categoryLogger.error(`${this.operationName} failed`, error, {
      ...endContext,
      durationMs: duration.toFixed(2),
    });
  }

  warn(message: string, context?: LogContext): void {
    const duration = performance.now() - this.startTime;
    this.categoryLogger.warn(`${this.operationName}: ${message}`, {
      ...context,
      elapsedMs: duration.toFixed(2),
    });
  }
}

/**
 * Helper to create operation logger
 */
export function createOperationLogger(
  categoryLogger: CategoryLogger,
  operationName: string,
  startContext?: LogContext,
): OperationLogger {
  return new OperationLogger(categoryLogger, operationName, startContext);
}
