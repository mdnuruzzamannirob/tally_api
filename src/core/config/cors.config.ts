import type { CorsOptions } from "cors";

import { env } from "./env.js";
import { ALLOWED_REQUEST_HEADERS, SUPPORTED_HTTP_METHODS } from "./app.config.js";

const localFrontendOrigins = ["localhost", "127.0.0.1"].flatMap((host) =>
  Array.from({ length: 6 }, (_, index) => `http://${host}:${3000 + index}`),
);
export const allowedFrontendOrigins = new Set([
  new URL(env.WEB_APP_URL).origin,
  ...(env.NODE_ENV === "production" ? [] : localFrontendOrigins),
]);

export const corsOptions: CorsOptions = {
  origin: (requestOrigin, callback) => {
    callback(null, !requestOrigin || allowedFrontendOrigins.has(requestOrigin));
  },
  credentials: true,
  methods: SUPPORTED_HTTP_METHODS,
  allowedHeaders: ALLOWED_REQUEST_HEADERS,
};
