import type { CorsOptions } from "cors";

import { env } from "./env.js";
import { ALLOWED_REQUEST_HEADERS, SUPPORTED_HTTP_METHODS } from "./app.config.js";

export const corsOptions: CorsOptions = {
  origin: env.WEB_APP_URL,
  credentials: true,
  methods: SUPPORTED_HTTP_METHODS,
  allowedHeaders: ALLOWED_REQUEST_HEADERS,
};
