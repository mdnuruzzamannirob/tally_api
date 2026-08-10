import type { RequestHandler } from "express";
import type { z } from "zod";

type RequestSource = "body" | "params" | "query";

/** Validates and replaces one request input source before the controller runs. */
export function validateRequest<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  source: RequestSource,
): RequestHandler {
  return (request, _response, next) => {
    const result = schema.safeParse(request[source]);
    if (!result.success) return next(result.error);
    request[source] = result.data;
    return next();
  };
}
