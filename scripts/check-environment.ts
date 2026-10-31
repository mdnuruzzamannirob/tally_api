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
  const senderByProvider = {
    brevo: env.BREVO_FROM,
    resend: env.RESEND_FROM,
    sendgrid: env.SENDGRID_FROM,
    mailgun: env.MAILGUN_FROM,
    gmail: env.GMAIL_FROM,
    smtp: env.SMTP_FROM,
    console: undefined,
  } as const;
  const sender = senderByProvider[env.EMAIL_PROVIDER] ?? env.EMAIL_FROM;
  console.info(`Email provider: ${env.EMAIL_PROVIDER} | sender: ${sender}`);
  const configured = {
    brevo: Boolean(env.BREVO_API_KEY),
    resend: Boolean(env.RESEND_API_KEY),
    sendgrid: Boolean(env.SENDGRID_API_KEY),
    mailgun: Boolean(env.MAILGUN_API_KEY),
    gmail: Boolean(env.GMAIL_CLIENT_ID && env.GMAIL_CLIENT_SECRET && env.GMAIL_REFRESH_TOKEN),
    smtp: Boolean(
      env.EMAIL_SMTP_HOST && env.EMAIL_SMTP_PORT && env.EMAIL_SMTP_USER && env.EMAIL_SMTP_PASSWORD,
    ),
    console: true,
  } as const;
  console.info(
    `Email credentials: ${configured[env.EMAIL_PROVIDER] ? "configured" : "not configured"}`,
  );
  console.info(`Notification worker: ${env.NOTIFICATION_WORKER_ENABLED ? "enabled" : "disabled"}`);
  console.info(
    `Resend webhook: ${env.RESEND_WEBHOOK_SECRET ? "configured" : "not configured (email sending still works)"}`,
  );
  if (env.EMAIL_PROVIDER === "resend" && sender?.toLowerCase().endsWith("@resend.dev"))
    console.warn(
      "Resend test sender: use your Resend account's own recipient address; verify a domain for other recipients.",
    );
  if (env.EMAIL_PROVIDER === "console")
    console.warn("Console provider logs emails; it does not send them.");
  // This validates configuration, not provider credentials, DNS, or connectivity.
}
