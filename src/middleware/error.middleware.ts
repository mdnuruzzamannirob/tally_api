import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { ApiError } from "../utils/api-error.js";

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
  }

  const errorName = error instanceof Error ? error.name : "UnknownError";
  const logPayload = { requestId, statusCode, code, errorName };
  if (statusCode >= 500) logger.error(logPayload, "Request failed");
  else logger.warn(logPayload, "Request failed");

  const errorBody: { code: string; message: string; requestId?: string; details?: unknown } = {
    code,
    message:
      statusCode >= 500 && env.NODE_ENV === "production"
        ? "An unexpected error occurred."
        : message,
  };
  if (requestId) errorBody.requestId = requestId;
  if (details !== undefined) errorBody.details = details;

  response.status(statusCode).json({ success: false, error: errorBody });
};
