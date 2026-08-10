import nodemailer from "nodemailer";

import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";

export interface EmailService {
  sendVerificationEmail(input: { email: string; token: string }): Promise<void>;
  sendPasswordResetEmail(input: { email: string; token: string }): Promise<void>;
}

export function buildVerificationUrl(token: string): string {
  const url = new URL("/verify-email", env.WEB_APP_URL);
  url.searchParams.set("token", token);
  return url.toString();
}

export function buildPasswordResetUrl(token: string): string {
  const url = new URL("/reset-password", env.WEB_APP_URL);
  url.searchParams.set("token", token);
  return url.toString();
}

type EmailMessage = { to: string; subject: string; html: string };

function verificationMessage(input: { email: string; token: string }): EmailMessage {
  return {
    to: input.email,
    subject: "Verify your Tally email",
    html: `<p>Verify your Tally email address:</p><p><a href="${buildVerificationUrl(input.token)}">Verify email</a></p>`,
  };
}

function passwordResetMessage(input: { email: string; token: string }): EmailMessage {
  return {
    to: input.email,
    subject: "Reset your Tally password",
    html: `<p>Reset your Tally password:</p><p><a href="${buildPasswordResetUrl(input.token)}">Reset password</a></p>`,
  };
}

function reportDeliveryFailure(provider: string, error: unknown): never {
  logger.error(
    {
      event: "email_delivery_failed",
      provider,
      errorName: error instanceof Error ? error.name : "UnknownError",
    },
    "Email delivery failed",
  );
  throw new Error("Email delivery failed.");
}

async function sendJsonEmail(
  provider: "resend" | "sendgrid" | "mailgun",
  message: EmailMessage,
): Promise<void> {
  const apiKey = env.EMAIL_API_KEY;
  if (!apiKey) throw new Error("Email provider credentials are not configured.");

  const request =
    provider === "resend"
      ? {
          url: env.EMAIL_API_BASE_URL ?? "https://api.resend.com/emails",
          body: {
            from: env.EMAIL_FROM,
            to: [message.to],
            subject: message.subject,
            html: message.html,
          },
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        }
      : provider === "sendgrid"
        ? {
            url: env.EMAIL_API_BASE_URL ?? "https://api.sendgrid.com/v3/mail/send",
            body: {
              personalizations: [{ to: [{ email: message.to }] }],
              from: { email: env.EMAIL_FROM },
              subject: message.subject,
              content: [{ type: "text/html", value: message.html }],
            },
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          }
        : {
            url:
              env.EMAIL_API_BASE_URL ??
              `https://api.mailgun.net/v3/${env.EMAIL_MAILGUN_DOMAIN}/messages`,
            body: new URLSearchParams({
              from: env.EMAIL_FROM,
              to: message.to,
              subject: message.subject,
              html: message.html,
            }),
            headers: { Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}` },
          };

  try {
    const response = await fetch(request.url, {
      method: "POST",
      headers: request.headers,
      body: request.body instanceof URLSearchParams ? request.body : JSON.stringify(request.body),
    });
    if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}.`);
  } catch (error) {
    reportDeliveryFailure(provider, error);
  }
}

export class ConsoleEmailService implements EmailService {
  async sendVerificationEmail(input: { email: string; token: string }): Promise<void> {
    void input;
    logger.info({ event: "verification_email_created" }, "Verification email created");
  }

  async sendPasswordResetEmail(input: { email: string; token: string }): Promise<void> {
    void input;
    logger.info({ event: "password_reset_email_created" }, "Password reset email created");
  }
}

class TransactionalEmailService implements EmailService {
  constructor(private readonly provider: "resend" | "sendgrid" | "mailgun" | "smtp") {}

  private send(message: EmailMessage): Promise<void> {
    if (this.provider !== "smtp") return sendJsonEmail(this.provider, message);
    const transport = nodemailer.createTransport({
      host: env.EMAIL_SMTP_HOST,
      port: env.EMAIL_SMTP_PORT,
      secure: env.EMAIL_SMTP_SECURE,
      auth: { user: env.EMAIL_SMTP_USER, pass: env.EMAIL_SMTP_PASSWORD },
    });
    return transport
      .sendMail({
        from: env.EMAIL_FROM,
        to: message.to,
        subject: message.subject,
        html: message.html,
      })
      .then(() => undefined)
      .catch((error: unknown) => reportDeliveryFailure(this.provider, error));
  }

  sendVerificationEmail(input: { email: string; token: string }): Promise<void> {
    return this.send(verificationMessage(input));
  }

  sendPasswordResetEmail(input: { email: string; token: string }): Promise<void> {
    return this.send(passwordResetMessage(input));
  }
}

export function createEmailService(): EmailService {
  if (env.EMAIL_PROVIDER === "console") return new ConsoleEmailService();
  return new TransactionalEmailService(env.EMAIL_PROVIDER);
}
