import pino from "pino";
import { describe, expect, it } from "vitest";
import { loggerRedact } from "../../../src/core/logger/redact.js";

describe("structured log boundary", () => {
  it("redacts credentials, callback URLs, bodies, and errors while preserving correlation", () => {
    let output = "";
    const logger = pino(
      { redact: loggerRedact },
      {
        write: (chunk: string) => {
          output += chunk;
        },
      },
    );
    logger.info(
      {
        requestId: "public-correlation",
        req: {
          headers: {
            authorization: "PRIVATE_BEARER",
            cookie: "PRIVATE_COOKIE",
            referer: "PRIVATE_REFERER",
          },
          url: "PRIVATE_URL",
          body: { password: "PRIVATE_PASSWORD" },
          query: { token: "PRIVATE_QUERY" },
        },
        res: { headers: { "set-cookie": "PRIVATE_SET_COOKIE", location: "PRIVATE_CALLBACK" } },
        err: { message: "PRIVATE_ERROR", stack: "PRIVATE_STACK" },
      },
      "request completed",
    );
    expect(output).not.toContain("PRIVATE_");
    expect(JSON.parse(output)).toMatchObject({
      requestId: "public-correlation",
      msg: "request completed",
    });
    expect(output).toContain("[REDACTED]");
  });
});
