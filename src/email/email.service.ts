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
    html: emailTemplate({
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
    html: emailTemplate({
      eyebrow: "Tally account security",
      title: "Reset your password",
      body: "We received a request to reset your Tally password. Click the button below to choose a new one.",
      buttonLabel: "Reset password",
      buttonUrl: buildPasswordResetUrl(input.token),
      note: "If you did not request a password reset, no action is needed. This link is time-limited.",
    }),
  };
}

function emailTemplate(input: {
  eyebrow: string;
  title: string;
  body: string;
  buttonLabel: string;
  buttonUrl: string;
  note: string;
}): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f6fb;font-family:Arial,sans-serif;color:#172033">
<div style="padding:40px 16px"><div style="max-width:560px;margin:auto;background:#fff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden">
<div style="background:#4f46e5;padding:28px 32px;color:#fff;font-size:22px;font-weight:700">Tally</div>
<div style="padding:36px 32px"><div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#6366f1;font-weight:700">${input.eyebrow}</div>
<h1 style="font-size:28px;line-height:1.2;margin:12px 0 16px">${input.title}</h1>
<p style="font-size:16px;line-height:1.6;color:#4b5563">${input.body}</p>
<p style="margin:28px 0"><a href="${input.buttonUrl}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:13px 22px;border-radius:8px;font-weight:700">${input.buttonLabel}</a></p>
<p style="font-size:13px;line-height:1.6;color:#6b7280">${input.note}</p>
<p style="font-size:13px;line-height:1.6;color:#9ca3af">If the button does not work, copy and paste this link into your browser:<br>${input.buttonUrl}</p>
</div><div style="padding:20px 32px;background:#f9fafb;color:#9ca3af;font-size:12px">© Tally · Your application tracking workspace</div>
</div></div></body></html>`;
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
