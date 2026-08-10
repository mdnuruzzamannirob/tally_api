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

/** Development provider. It deliberately never logs the recipient, link, or token. */
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

class UnavailableEmailService implements EmailService {
  async sendVerificationEmail(_input: { email: string; token: string }): Promise<void> {
    void _input;
    throw new Error("The configured email provider is not available.");
  }

  async sendPasswordResetEmail(_input: { email: string; token: string }): Promise<void> {
    void _input;
    throw new Error("The configured email provider is not available.");
  }
}

export function createEmailService(): EmailService {
  if (env.EMAIL_PROVIDER === "console") return new ConsoleEmailService();
  return new UnavailableEmailService();
}
