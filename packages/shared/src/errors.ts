/**
 * Every error that crosses a service boundary is one of these. Route
 * handlers catch `AppError` and map it to `{ error: { code, message,
 * requestId, details? } }`; anything else is logged with a stack trace
 * server-side and reported to the client as an opaque INTERNAL_ERROR (never
 * leak stack traces in production responses).
 */
export type ErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "UNAUTHENTICATED"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "BUDGET_EXCEEDED"
  | "USAGE_LIMIT_EXCEEDED"
  | "SUBSCRIPTION_INACTIVE"
  | "PUBLISH_BLOCKED"
  | "PROVIDER_ERROR"
  | "INTERNAL_ERROR";

export interface AppErrorOptions {
  code: ErrorCode;
  message: string;
  httpStatus: number;
  details?: Record<string, unknown>;
  cause?: unknown;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;
  readonly details?: Record<string, unknown>;

  constructor(options: AppErrorOptions) {
    super(options.message, { cause: options.cause });
    this.name = "AppError";
    this.code = options.code;
    this.httpStatus = options.httpStatus;
    this.details = options.details;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super({ code: "VALIDATION_ERROR", message, httpStatus: 400, details });
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super({
      code: "NOT_FOUND",
      message: id ? `${resource} '${id}' was not found` : `${resource} was not found`,
      httpStatus: 404,
    });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to perform this action") {
    super({ code: "FORBIDDEN", message, httpStatus: 403 });
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = "Authentication required") {
    super({ code: "UNAUTHENTICATED", message, httpStatus: 401 });
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super({ code: "CONFLICT", message, httpStatus: 409, details });
  }
}

export class RateLimitedError extends AppError {
  constructor(retryAfterSeconds?: number) {
    super({
      code: "RATE_LIMITED",
      message: "Too many requests",
      httpStatus: 429,
      details: retryAfterSeconds ? { retryAfterSeconds } : undefined,
    });
  }
}

export class BudgetExceededError extends AppError {
  constructor(message = "Workspace spending limit has been reached") {
    super({ code: "BUDGET_EXCEEDED", message, httpStatus: 402 });
  }
}

export class UsageLimitExceededError extends AppError {
  constructor(message = "Plan usage limit has been reached") {
    super({ code: "USAGE_LIMIT_EXCEEDED", message, httpStatus: 402 });
  }
}

export class SubscriptionInactiveError extends AppError {
  constructor(message = "Workspace subscription is not active") {
    super({ code: "SUBSCRIPTION_INACTIVE", message, httpStatus: 402 });
  }
}

/** Thrown by the publish-blocking guard (brief §9) with the specific reason. */
export class PublishBlockedError extends AppError {
  constructor(reason: string) {
    super({ code: "PUBLISH_BLOCKED", message: reason, httpStatus: 422 });
  }
}

/**
 * Retry classification for provider errors. `TRANSIENT`/`RATE_LIMIT` are
 * safe to retry with backoff; `AUTH`/`VALIDATION`/`UNSUPPORTED` are not.
 */
export type ProviderErrorCategory =
  "TRANSIENT" | "RATE_LIMIT" | "AUTH" | "VALIDATION" | "UNSUPPORTED";

export interface ProviderErrorOptions {
  provider: string;
  category: ProviderErrorCategory;
  message: string;
  cause?: unknown;
  retryAfterSeconds?: number;
}

export class ProviderError extends AppError {
  readonly provider: string;
  readonly category: ProviderErrorCategory;
  readonly retryable: boolean;
  readonly retryAfterSeconds?: number;

  constructor(options: ProviderErrorOptions) {
    super({
      code: "PROVIDER_ERROR",
      message: `[${options.provider}] ${options.message}`,
      httpStatus: options.category === "RATE_LIMIT" ? 429 : 502,
      cause: options.cause,
    });
    this.name = "ProviderError";
    this.provider = options.provider;
    this.category = options.category;
    this.retryable = options.category === "TRANSIENT" || options.category === "RATE_LIMIT";
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/** Shape returned to API clients — never includes a stack trace. */
export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    requestId: string;
    details?: Record<string, unknown>;
  };
}

export function toApiErrorBody(error: unknown, requestId: string): ApiErrorBody {
  if (isAppError(error)) {
    return {
      error: {
        code: error.code,
        message: error.message,
        requestId,
        details: error.details,
      },
    };
  }
  return {
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
      requestId,
    },
  };
}
