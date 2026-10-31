import { env } from "./env.js";

const fromByProvider = {
  brevo: env.BREVO_FROM,
  resend: env.RESEND_FROM,
  sendgrid: env.SENDGRID_FROM,
  mailgun: env.MAILGUN_FROM,
  gmail: env.GMAIL_FROM,
  smtp: env.SMTP_FROM,
  console: undefined,
} as const;
const keyByProvider = {
  resend: env.RESEND_API_KEY,
  sendgrid: env.SENDGRID_API_KEY,
  mailgun: env.MAILGUN_API_KEY,
  brevo: undefined,
  gmail: undefined,
  smtp: undefined,
  console: undefined,
} as const;

export const emailConfig = {
  provider: env.EMAIL_PROVIDER,
  // env.schema verifies that the selected provider's sender is present.
  from: fromByProvider[env.EMAIL_PROVIDER] ?? env.EMAIL_FROM ?? "",
  apiKey: keyByProvider[env.EMAIL_PROVIDER],
  brevoApiKey: env.BREVO_API_KEY,
  mailgunDomain: env.EMAIL_MAILGUN_DOMAIN,
  gmail: {
    clientId: env.GMAIL_CLIENT_ID,
    clientSecret: env.GMAIL_CLIENT_SECRET,
    refreshToken: env.GMAIL_REFRESH_TOKEN,
  },
  smtp: {
    host: env.EMAIL_SMTP_HOST,
    port: env.EMAIL_SMTP_PORT,
    secure: env.EMAIL_SMTP_SECURE,
    user: env.EMAIL_SMTP_USER,
    password: env.EMAIL_SMTP_PASSWORD,
  },
} as const;
