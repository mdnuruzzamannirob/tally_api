import nodemailer from "nodemailer";

import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";

export type EmailMessage = { to: string; subject: string; html: string };

export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
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

export class TransactionalEmailProvider implements EmailProvider {
  constructor(private readonly provider: "resend" | "sendgrid" | "mailgun" | "smtp") {}

  send(message: EmailMessage): Promise<void> {
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
}
