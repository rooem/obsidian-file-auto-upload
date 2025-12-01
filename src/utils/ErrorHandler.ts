import { t } from "../i18n";
import { logger } from "./Logger";

/**
 * Error result type
 */
export interface ErrorResult {
  success: false;
  error: string;
}

/**
 * Success result type with optional data
 */
export interface SuccessResult<T = void> {
  success: true;
  data?: T;
}

/**
 * Union type for operation results
 */
export type Result<T = void> = SuccessResult<T> | ErrorResult;

/**
 * Handle errors and return standardized error result
 * @param error - Error object or message
 * @param contextKey - Optional i18n key for context
 * @returns ErrorResult with formatted message
 */
export function handleError(error: unknown, contextKey?: string): ErrorResult {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const context = contextKey ? t(contextKey) : "";

  logger.error("ErrorHandler", context || "Error", errorMessage);

  return {
    success: false,
    error: context ? `${context}: ${errorMessage}` : errorMessage,
  };
}

/**
 * Create success result
 * @param data - Optional data to include
 * @returns SuccessResult
 */
export function success<T>(data?: T): SuccessResult<T> {
  return {
    success: true,
    data,
  };
}

/**
 * Create failure result with i18n error message
 * @param errorKey - i18n key for error message
 * @param fallback - Fallback message if key not found
 * @returns ErrorResult
 */
export function failure(errorKey: string, fallback?: string): ErrorResult {
  return {
    success: false,
    error: t(errorKey) || fallback || errorKey,
  };
}

/**
 * Create failure result with context and error details
 * @param contextKey - i18n key for context
 * @param error - Error object or message
 * @returns ErrorResult with formatted message
 */
export function failureWithContext(
  contextKey: string,
  error: unknown,
): ErrorResult {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const context = t(contextKey);

  logger.error("ErrorHandler", context, errorMessage);

  return {
    success: false,
    error: `${context}: ${errorMessage}`,
  };
}
