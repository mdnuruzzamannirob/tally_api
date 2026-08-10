import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

import { env } from "../config/env.js";
import { ApiError } from "../lib/api-error.js";
import type { ErrorResponse } from "../lib/api-response.js";
import { logger } from "../lib/logger.js";

type HttpError = Error & { status?: number; statusCode?: number; type?: string };

function validationDetails(error: ZodError): Record<string, string[]> {
  return error.issues.reduce<Record<string, string[]>>((details, issue) => {
    const field = issue.path.length ? issue.path.join(".") : "root";
    (details[field] ??= []).push(issue.message);
    return details;
  }, {});
}

export const errorMiddleware: ErrorRequestHandler = (error: unknown, request, response, _next) => {
  void _next;
  const requestId = request.requestId;
  let statusCode = 500;
  let code = "INTERNAL_ERROR";
  let message = "An unexpected error occurred.";
  let details: unknown;

  if (error instanceof ApiError) {
    ({ statusCode, code, message, details } = error);
  } else if (error instanceof ZodError) {
    statusCode = 400;
    code = "VALIDATION_ERROR";
    message = "Validation failed";
    details = validationDetails(error);
  } else if ((error as HttpError).type === "entity.parse.failed") {
    statusCode = 400;
    code = "BAD_REQUEST";
    message = "Malformed JSON request body.";
  } else if ((error as HttpError).type === "entity.too.large") {
    statusCode = 413;
    code = "PAYLOAD_TOO_LARGE";
    message = "Request body exceeds the maximum allowed size.";
  }

  const errorName = error instanceof Error ? error.name : "UnknownError";
  const logPayload = { requestId, statusCode, code, errorName };
  if (statusCode >= 500) logger.error(logPayload, "Request failed");
  else logger.warn(logPayload, "Request failed");

  const safeMessage =
    statusCode >= 500 && env.NODE_ENV === "production" ? "An unexpected error occurred." : message;
  const body: ErrorResponse = {
    success: false,
    message: safeMessage,
    error: {
      code,
      ...(details !== undefined ? { details: details as Record<string, string[]> } : {}),
    },
    meta: { requestId: requestId ?? "unknown" },
  };

  response.status(statusCode).json(body);
};
