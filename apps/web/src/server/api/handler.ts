import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ZodError } from "zod";

import { auth } from "@contentforge/auth";
import {
  ForbiddenError,
  UnauthenticatedError,
  ValidationError,
  createLogger,
  isAppError,
  toApiErrorBody,
} from "@contentforge/shared";
import { enforceRateLimit } from "@/server/security/rate-limit";

const logger = createLogger({ name: "api" });

export interface ApiContext {
  requestId: string;
  userId: string | undefined;
}

type RouteHandler<TParams> = (
  req: NextRequest,
  ctx: ApiContext & { params: TParams },
) => Promise<NextResponse>;

/**
 * Wraps every /api/v1 route handler: assigns a request id (returned as
 * `X-Request-Id` and embedded in every error body so a user-reported bug can
 * be traced to a log line), maps thrown errors to the shared consistent
 * error envelope, and NEVER lets a stack trace reach the response body —
 * only `AppError` messages are client-visible, everything else logs
 * server-side and returns an opaque INTERNAL_ERROR.
 */
export function apiHandler<TParams = Record<string, string>>(
  handler: RouteHandler<TParams>,
  options: { requireAuth?: boolean } = { requireAuth: true },
) {
  return async (
    req: NextRequest,
    routeCtx: { params: Promise<TParams> },
  ): Promise<NextResponse> => {
    const requestId = req.headers.get("x-request-id") ?? randomUUID();
    const params = await routeCtx.params;

    try {
      const forwardedFor = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
      enforceRateLimit(`${forwardedFor}:${req.nextUrl.pathname}`, req.method === "GET" ? 180 : 60);
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
        const origin = req.headers.get("origin");
        const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
        if (origin && host && new URL(origin).host !== host)
          throw new ForbiddenError("Cross-origin mutation rejected");
      }
      const session = await auth();
      if (options.requireAuth && !session?.user?.id) {
        throw new UnauthenticatedError();
      }
      const response = await handler(req, {
        requestId,
        userId: session?.user?.id,
        params,
      });
      response.headers.set("X-Request-Id", requestId);
      return response;
    } catch (error) {
      const normalized: unknown =
        error instanceof ZodError
          ? new ValidationError("Request validation failed", {
              issues: error.issues,
            })
          : error;

      const body = toApiErrorBody(normalized, requestId);
      const httpStatus = isAppError(normalized) ? normalized.httpStatus : 500;
      if (httpStatus >= 500) {
        logger.error({ err: error, requestId }, "Unhandled API error");
      } else {
        logger.warn({ requestId, code: body.error.code }, "API request failed");
      }
      return NextResponse.json(body, {
        status: httpStatus,
        headers: { "X-Request-Id": requestId },
      });
    }
  };
}

export function jsonOk<T>(data: T, init?: number | ResponseInit): NextResponse {
  return NextResponse.json({ data }, typeof init === "number" ? { status: init } : init);
}
