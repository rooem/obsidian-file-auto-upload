/**
 * Error related type definitions
 */

/**
 * Error codes for the application
 */
export enum ErrorCode {
  // Network errors
  NETWORK_ERROR = "NETWORK_ERROR",
  TIMEOUT_ERROR = "TIMEOUT_ERROR",

  // Authentication errors
  AUTH_ERROR = "AUTH_ERROR",
  INVALID_CREDENTIALS = "INVALID_CREDENTIALS",

  // Configuration errors
  INVALID_CONFIG = "INVALID_CONFIG",
  MISSING_CONFIG = "MISSING_CONFIG",

  // File errors
  FILE_TOO_LARGE = "FILE_TOO_LARGE",
  INVALID_FILE_TYPE = "INVALID_FILE_TYPE",
  FILE_NOT_FOUND = "FILE_NOT_FOUND",

  // Upload errors
  UPLOAD_FAILED = "UPLOAD_FAILED",
  DELETE_FAILED = "DELETE_FAILED",

  // Unknown error
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

/**
 * Application error interface
 */
export interface AppError {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
  timestamp: Date;
}

/**
 * Custom error class for upload operations
 */
export class UploadError extends Error {
  public readonly code: ErrorCode;
  public readonly details?: Record<string, unknown>;
  public readonly timestamp: Date;

  constructor(
    code: ErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "UploadError";
    this.code = code;
    this.details = details;
    this.timestamp = new Date();

    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, UploadError);
    }
  }

  toJSON(): AppError {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp,
    };
  }
}
