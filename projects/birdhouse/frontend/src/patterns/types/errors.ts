// ABOUTME: Custom error types for pattern operations
// ABOUTME: Provides structured error information with HTTP context and error chaining

/**
 * Error thrown when pattern fetch operations fail
 * Includes HTTP status, response body, and URL for debugging
 * Supports error chaining via ES2022 cause property
 */
export class FetchPatternError extends Error {
  readonly statusCode: number;
  readonly responseBody: string;
  readonly url: string;

  constructor(message: string, statusCode: number, responseBody: string, url: string, cause?: Error) {
    super(message, { cause });
    this.name = "FetchPatternError";
    this.statusCode = statusCode;
    this.responseBody = responseBody;
    this.url = url;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      responseBody: this.responseBody,
      url: this.url,
      cause: (this.cause as Error | undefined)?.message,
      stack: this.stack,
    };
  }
}
