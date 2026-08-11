import pino, { type LoggerOptions } from "pino";

import { env } from "../config/env.js";
import { loggerRedact } from "./redact.js";

const loggerOptions: LoggerOptions = {
  level: env.LOG_LEVEL,
  redact: loggerRedact,
};

if (env.NODE_ENV === "development") {
  loggerOptions.transport = {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "SYS:standard",
      singleLine: true,
      ignore: "pid,hostname",
    },
  };
}

export const logger = pino(loggerOptions);
