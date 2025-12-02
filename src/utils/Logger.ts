import { DeveloperSettings } from "../components/DeveloperSettings";

export enum LogLevel {
  DEBUG = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

class Logger {
  private static instance: Logger;
  private level: LogLevel = LogLevel.DEBUG;

  private constructor() { }

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

  debug(context: string, message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      const timestamp = new Date().toISOString();
      const prefix = `[${timestamp}] [DEBUG] [${context}]`;
      const sanitizedArgs = args.map((arg) => this.sanitize(arg));
      console.debug(
        prefix,
        message,
        ...sanitizedArgs,
      );
    }
  }

  warn(context: string, message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      const timestamp = new Date().toISOString();
      const prefix = `[${timestamp}] [WARN] [${context}]`;
      const sanitizedArgs = args.map((arg) => this.sanitize(arg));
      console.warn(
        prefix,
        message,
        ...sanitizedArgs,
      );
    }
  }

  error(context: string, message: string, ...args: unknown[]): void {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [ERROR] [${context}]`;
    const sanitizedArgs = args.map((arg) => this.sanitize(arg));
    console.error(
      prefix,
      message,
      ...sanitizedArgs,
    );
  }
}

export const logger = Logger.getInstance();
