import { renderEmail } from "./email-template.js";
import { BrevoEmailProvider } from "./providers/brevo.provider.js";
import { GmailApiProvider } from "./providers/gmail-api.provider.js";
import { emailConfig } from "../core/config/email.config.js";
import { buildPasswordResetUrl, buildVerificationUrl } from "./email-links.js";
import type { EmailMessage, EmailProvider, EmailService } from "./email.types.js";
import { ConsoleEmailProvider } from "./providers/console.provider.js";
import { MailgunEmailProvider } from "./providers/mailgun.provider.js";
import { ResendEmailProvider } from "./providers/resend.provider.js";
import { SendGridEmailProvider } from "./providers/sendgrid.provider.js";
import { SmtpEmailProvider } from "./providers/smtp.provider.js";

export type { EmailService } from "./email.types.js";
export { buildPasswordResetUrl, buildVerificationUrl } from "./email-links.js";

function verificationMessage(input: { email: string; token: string }): EmailMessage {
  return {
    to: input.email,
    subject: "Verify your Tally email",
    ...renderEmail({
      eyebrow: "Welcome to Tally",
      title: "Verify your email address",
      body: "Thanks for joining Tally. Confirm your email address to finish setting up your account.",
      buttonLabel: "Verify email address",
      buttonUrl: buildVerificationUrl(input.token),
      note: "If you did not create a Tally account, you can safely ignore this email.",
    }),
  };
}

function passwordResetMessage(input: { email: string; token: string }): EmailMessage {
  return {
    to: input.email,
    subject: "Reset your Tally password",
    ...renderEmail({
      eyebrow: "Tally account security",
      title: "Reset your password",
      body: "We received a request to reset your Tally password. Click the button below to choose a new one.",
      buttonLabel: "Reset password",
      buttonUrl: buildPasswordResetUrl(input.token),
      note: "If you did not request a password reset, no action is needed. This link is time-limited.",
    }),
  };
}

class DefaultEmailService implements EmailService {
  constructor(private readonly provider: EmailProvider) {}

  private async send(message: EmailMessage): Promise<void> {
    await this.provider.send(message);
  }

  sendVerificationEmail(input: { email: string; token: string }): Promise<void> {
    return this.send(verificationMessage(input));
  }

  sendPasswordResetEmail(input: { email: string; token: string }): Promise<void> {
    return this.send(passwordResetMessage(input));
  }
}

export function createEmailProvider(): EmailProvider {
  const providers: Record<typeof emailConfig.provider, EmailProvider> = {
    console: new ConsoleEmailProvider(),
    brevo: new BrevoEmailProvider(),
    gmail: new GmailApiProvider(),
    resend: new ResendEmailProvider(),
    sendgrid: new SendGridEmailProvider(),
    mailgun: new MailgunEmailProvider(),
    smtp: new SmtpEmailProvider(),
  };
  return providers[emailConfig.provider];
}

export function createEmailService(): EmailService {
  return new DefaultEmailService(createEmailProvider());
}
