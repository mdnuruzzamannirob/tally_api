import type { Response } from "express";

export interface ResponseMeta {
  requestId?: string;
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
}

export interface SuccessResponse<T> {
  success: true;
  message: string;
  data: T;
  meta?: ResponseMeta;
}

export interface SendSuccessOptions {
  statusCode?: number;
  message?: string;
  meta?: Omit<ResponseMeta, "requestId">;
}

export function sendSuccess<T>(
  response: Response,
  data: T,
  options: SendSuccessOptions | number = {},
): Response {
  const resolvedOptions = typeof options === "number" ? { statusCode: options } : options;
  const requestId = response.req.requestId;
  const meta = { ...(requestId ? { requestId } : {}), ...(resolvedOptions.meta ?? {}) };
  let responseData = data;
  let responseMessage = resolvedOptions.message;
  if (typeof data === "object" && data !== null && "message" in data) {
    const messageValue = (data as { message?: unknown }).message;
    if (typeof messageValue === "string") {
      responseMessage ??= messageValue;
      const { message: _message, ...dataWithoutMessage } = data as Record<string, unknown>;
      void _message;
      responseData = dataWithoutMessage as T;
    }
  }
  const body: SuccessResponse<T> = {
    success: true,
    message: responseMessage ?? "Request completed successfully.",
    data: responseData,
    ...(Object.keys(meta).length ? { meta } : {}),
  };
  return response.status(resolvedOptions.statusCode ?? 200).json(body);
}
