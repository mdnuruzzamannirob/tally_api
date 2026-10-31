import { loadEnvironment } from "../src/core/config/load-environment.js";
import { parseEnvironment } from "../src/core/config/env.schema.js";

const profile = loadEnvironment();
const result = (() => {
  try {
    return { env: parseEnvironment(process.env) };
  } catch (error) {
    const issues = (error as { issues?: Array<{ path: unknown[]; message: string }> }).issues;
    console.error(`Invalid environment (${profile}):`);
    for (const issue of issues ?? []) console.error(`- ${issue.path.join(".")}: ${issue.message}`);
    process.exitCode = 1;
    return { env: undefined };
  }
})();
if (result.env) {
  const env = result.env;
  const database = new URL(env.DATABASE_URL);
  console.info(
    `Environment valid: ${env.NODE_ENV} (${profile}; injected variables take precedence)`,
  );
  console.info(`API: ${env.API_BASE_URL} | Web: ${env.WEB_APP_URL}`);
  console.info(`Database: ${database.hostname}:${database.port || "5432"}${database.pathname}`);
  console.info(`Email provider: ${env.EMAIL_PROVIDER} | sender: ${env.EMAIL_FROM}`);
  console.info(
    `Email credentials: ${env.EMAIL_API_KEY || env.EMAIL_SMTP_PASSWORD || (env.GMAIL_CLIENT_ID && env.GMAIL_CLIENT_SECRET && env.GMAIL_REFRESH_TOKEN) ? "configured" : "not configured"}`,
  );
  console.info(`Notification worker: ${env.NOTIFICATION_WORKER_ENABLED ? "enabled" : "disabled"}`);
  console.info(
    `Resend webhook: ${env.RESEND_WEBHOOK_SECRET ? "configured" : "not configured (email sending still works)"}`,
  );
  if (env.EMAIL_FROM.toLowerCase().endsWith("@resend.dev"))
    console.warn(
      "Resend test sender: use your Resend account's own recipient address; verify a domain for other recipients.",
    );
  if (env.EMAIL_PROVIDER === "console")
    console.warn("Console provider logs emails; it does not send them.");
  // This validates configuration, not provider credentials, DNS, or connectivity.
}
