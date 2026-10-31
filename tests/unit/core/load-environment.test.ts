import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadEnvironment } from "../../../src/core/config/load-environment.js";

let directory: string;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "tally-env-"));
  writeFileSync(join(directory, ".env"), "EMAIL_PROVIDER=resend\nRESEND_API_KEY=local-key\n");
  writeFileSync(
    join(directory, ".env.production"),
    "EMAIL_PROVIDER=resend\nRESEND_API_KEY=production-key\n",
  );
  writeFileSync(
    join(directory, ".env.test"),
    "EMAIL_PROVIDER=console\nNOTIFICATION_WORKER_ENABLED=false\n",
  );
});
afterEach(() => rmSync(directory, { recursive: true, force: true }));
describe("isolated environment profiles", () => {
  it("selects local development and keeps injected overrides", () => {
    const environment: NodeJS.ProcessEnv = { RESEND_API_KEY: "injected-key" };
    expect(loadEnvironment(environment, directory)).toBe(".env");
    expect(environment.EMAIL_PROVIDER).toBe("resend");
    expect(environment.RESEND_API_KEY).toBe("injected-key");
  });
  it("does not mix local credentials into production", () => {
    const environment: NodeJS.ProcessEnv = { NODE_ENV: "production" };
    expect(loadEnvironment(environment, directory)).toBe(".env.production");
    expect(environment.RESEND_API_KEY).toBe("production-key");
    rmSync(join(directory, ".env.production"));
    const hosted: NodeJS.ProcessEnv = { NODE_ENV: "production", DATABASE_URL: "platform-value" };
    loadEnvironment(hosted, directory);
    expect(hosted.DATABASE_URL).toBe("platform-value");
    expect(hosted.RESEND_API_KEY).toBeUndefined();
  });
  it("isolates tests from real delivery credentials", () => {
    const environment: NodeJS.ProcessEnv = { NODE_ENV: "test" };
    expect(loadEnvironment(environment, directory)).toBe(".env.test");
    expect(environment.EMAIL_PROVIDER).toBe("console");
    expect(environment.NOTIFICATION_WORKER_ENABLED).toBe("false");
    expect(environment.RESEND_API_KEY).toBeUndefined();
  });
});
