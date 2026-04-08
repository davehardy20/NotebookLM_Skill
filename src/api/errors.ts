/**
 * API error classes for NotebookLM client
 * Extends the core error system with API-specific errors
 */

import { AppError } from '../core/errors.js';

/**
 * Programmatic error codes for API errors
 * These codes can be used for programmatic error handling and internationalization
 */
export const ErrorCode = {
  // General API errors
  API_ERROR: 'API_ERROR',

  // Authentication errors
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  CSRF_EXTRACTION_ERROR: 'CSRF_EXTRACTION_ERROR',
  COOKIE_VALIDATION_ERROR: 'COOKIE_VALIDATION_ERROR',

  // RPC/Protocol errors
  RPC_ERROR: 'RPC_ERROR',
  PARSE_ERROR: 'PARSE_ERROR',

  // Rate limiting and network
  RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  REQUEST_TIMEOUT_ERROR: 'REQUEST_TIMEOUT_ERROR',

  // Resource errors
  NOTEBOOK_NOT_FOUND: 'NOTEBOOK_NOT_FOUND',
  SOURCE_NOT_FOUND: 'SOURCE_NOT_FOUND',

  // Query errors
  QUERY_REJECTED: 'QUERY_REJECTED',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * Base class for all API-related errors
 */
export class APIError extends AppError {
  constructor(
    message: string,
    public statusCode: number = 500,
    public detail?: string,
    public code: ErrorCode = ErrorCode.API_ERROR
  ) {
    super(message, code, statusCode);
    this.name = 'APIError';
    Object.setPrototypeOf(this, APIError.prototype);
  }
}

/**
 * Authentication error - invalid or expired credentials
 */
export class AuthenticationError extends APIError {
  constructor(
    message: string = 'Authentication failed. Please run "notebooklm auth import" to re-authenticate.',
    public hint?: string
  ) {
    super(message, 401, undefined, ErrorCode.AUTHENTICATION_ERROR);
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/**
 * RPC error - error returned from NotebookLM batchexecute API
 */
export class RPCError extends APIError {
  constructor(
    message: string,
    public rpcId?: string,
    public errorCode?: number,
    public detailType?: string,
    public detailData?: unknown
  ) {
    super(message, 500, undefined, ErrorCode.RPC_ERROR);
    this.name = 'RPCError';
    Object.setPrototypeOf(this, RPCError.prototype);
  }
}

/**
 * Rate limit error - too many requests
 */
export class RateLimitError extends APIError {
  constructor(
    message: string = 'Rate limit exceeded. Please try again later.',
    public retryAfter?: number // seconds
  ) {
    super(message, 429, undefined, ErrorCode.RATE_LIMIT_ERROR);
    this.name = 'RateLimitError';
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

/**
 * Network error - connection issues
 */
export class NetworkError extends APIError {
  constructor(
    message: string = 'Network error. Please check your connection.',
    public originalError?: Error
  ) {
    super(message, 503, undefined, ErrorCode.NETWORK_ERROR);
    this.name = 'NetworkError';
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

/**
 * Timeout error - request took too long
 */
export class RequestTimeoutError extends APIError {
  constructor(
    message: string = 'Request timed out. Please try again.',
    public timeoutMs?: number
  ) {
    super(message, 408, undefined, ErrorCode.REQUEST_TIMEOUT_ERROR);
    this.name = 'RequestTimeoutError';
    Object.setPrototypeOf(this, RequestTimeoutError.prototype);
  }
}

/**
 * CSRF token extraction error
 */
export class CSRFExtractionError extends APIError {
  constructor(
    message: string = 'Failed to extract CSRF token. Cookies may be expired.',
    public htmlSnippet?: string
  ) {
    super(message, 401, undefined, ErrorCode.CSRF_EXTRACTION_ERROR);
    this.name = 'CSRFExtractionError';
    Object.setPrototypeOf(this, CSRFExtractionError.prototype);
  }
}

/**
 * Cookie validation error
 */
export class CookieValidationError extends APIError {
  constructor(
    message: string,
    public missingCookies?: string[]
  ) {
    super(message, 401, undefined, ErrorCode.COOKIE_VALIDATION_ERROR);
    this.name = 'CookieValidationError';
    Object.setPrototypeOf(this, CookieValidationError.prototype);
  }
}

/**
 * Query rejected by Google (error code in response)
 */
export class QueryRejectedError extends APIError {
  constructor(
    message: string,
    public errorCode: number,
    public codeName: string,
    public errorType?: string,
    public rawDetail?: string
  ) {
    super(message, 400, undefined, ErrorCode.QUERY_REJECTED);
    this.name = 'QueryRejectedError';
    Object.setPrototypeOf(this, QueryRejectedError.prototype);
  }
}

/**
 * Notebook not found error
 */
export class NotebookNotFoundError extends APIError {
  constructor(notebookId: string) {
    super(`Notebook not found: ${notebookId}`, 404, undefined, ErrorCode.NOTEBOOK_NOT_FOUND);
    this.name = 'NotebookNotFoundError';
    Object.setPrototypeOf(this, NotebookNotFoundError.prototype);
  }
}

/**
 * Source not found error
 */
export class SourceNotFoundError extends APIError {
  constructor(sourceId: string) {
    super(`Source not found: ${sourceId}`, 404, undefined, ErrorCode.SOURCE_NOT_FOUND);
    this.name = 'SourceNotFoundError';
    Object.setPrototypeOf(this, SourceNotFoundError.prototype);
  }
}

/**
 * Parse error - failed to parse API response
 */
export class ParseError extends APIError {
  constructor(
    message: string = 'Failed to parse API response',
    public rawResponse?: string,
    public parseError?: Error
  ) {
    super(message, 500, undefined, ErrorCode.PARSE_ERROR);
    this.name = 'ParseError';
    Object.setPrototypeOf(this, ParseError.prototype);
  }
}

/**
 * Google error code names mapping
 */
export const GOOGLE_ERROR_CODES: Record<number, string> = {
  1: 'CANCELLED',
  2: 'UNKNOWN',
  3: 'INVALID_ARGUMENT',
  4: 'DEADLINE_EXCEEDED',
  5: 'NOT_FOUND',
  7: 'PERMISSION_DENIED',
  8: 'RESOURCE_EXHAUSTED',
  13: 'INTERNAL',
  14: 'UNAVAILABLE',
  16: 'UNAUTHENTICATED',
};

/**
 * Check if an error is retryable (network, rate limit, timeout)
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof RateLimitError) return true;
  if (error instanceof NetworkError) return true;
  if (error instanceof RequestTimeoutError) return true;
  if (error instanceof APIError && error.statusCode >= 500) return true;
  return false;
}

/**
 * Check if an error is an authentication error
 */
export function isAuthError(error: unknown): boolean {
  if (error instanceof AuthenticationError) return true;
  if (error instanceof CSRFExtractionError) return true;
  if (error instanceof CookieValidationError) return true;
  if (error instanceof APIError && error.statusCode === 401) return true;
  if (error instanceof APIError && error.statusCode === 403) return true;
  return false;
}
