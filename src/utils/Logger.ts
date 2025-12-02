import { DeveloperSettings } from "../components/DeveloperSettings";

export enum LogLevel {
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

class Logger {
  private static instance: Logger;
  private level: LogLevel = LogLevel.INFO;

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return (
      DeveloperSettings.isEnabled() &&
      DeveloperSettings.isDebugLoggingEnabled() &&
      level >= this.level
    );
  }

  /**
   * Sanitize sensitive data from objects before logging
   */
  private sanitize(obj: unknown): unknown {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj !== "object") {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitize(item));
    }

    const sanitized: Record<string, unknown> = {};
    const sensitiveKeys = [
      "access_key_id",
      "secret_access_key",
      "accessKeyId",
      "secretAccessKey",
      "password",
      "token",
      "apiKey",
      "api_key",
    ];

    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (
        sensitiveKeys.some((k) => key.toLowerCase().includes(k.toLowerCase()))
      ) {
        sanitized[key] = "***REDACTED***";
      } else if (typeof value === "object" && value !== null) {
        sanitized[key] = this.sanitize(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  private format(
    level: string,
    context: string,
    message: string,
    ...args: unknown[]
  ): void {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level}] [${context}]`;
    const sanitizedArgs = args.map((arg) => this.sanitize(arg));
    console[level.toLowerCase() as "log" | "warn" | "error"](
      prefix,
      message,
      ...sanitizedArgs,
    );
  }

  info(context: string, message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      this.format("INFO", context, message, ...args);
    }
  }

  warn(context: string, message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      this.format("WARN", context, message, ...args);
    }
  }

  error(context: string, message: string, ...args: unknown[]): void {
    this.format("ERROR", context, message, ...args);
  }
}

export const logger = Logger.getInstance();
