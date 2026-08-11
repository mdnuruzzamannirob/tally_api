import pino from "pino";

import { env } from "../config/env.js";
import { loggerRedact } from "./redact.js";

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: loggerRedact,
});
