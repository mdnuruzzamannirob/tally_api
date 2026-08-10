import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import {
  TransactionalEmailProvider,
  type EmailMessage,
  type EmailProvider,
} from "./email.provider.js";

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
  constructor(private readonly provider: EmailProvider) {}

  private send(message: EmailMessage): Promise<void> {
    return this.provider.send(message);
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
  return new TransactionalEmailService(new TransactionalEmailProvider(env.EMAIL_PROVIDER));
}
