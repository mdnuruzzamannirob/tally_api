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

class DefaultEmailService implements EmailService {
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
  const providers: Record<typeof emailConfig.provider, EmailProvider> = {
    console: new ConsoleEmailProvider(),
    resend: new ResendEmailProvider(),
    sendgrid: new SendGridEmailProvider(),
    mailgun: new MailgunEmailProvider(),
    smtp: new SmtpEmailProvider(),
  };
  return new DefaultEmailService(providers[emailConfig.provider]);
}
