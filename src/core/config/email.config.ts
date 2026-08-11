import { env } from "./env.js";

export const emailConfig = {
  provider: env.EMAIL_PROVIDER,
  from: env.EMAIL_FROM,
  apiKey: env.EMAIL_API_KEY,
  apiBaseUrl: env.EMAIL_API_BASE_URL,
  mailgunDomain: env.EMAIL_MAILGUN_DOMAIN,
  smtp: {
    host: env.EMAIL_SMTP_HOST,
    port: env.EMAIL_SMTP_PORT,
    secure: env.EMAIL_SMTP_SECURE,
    user: env.EMAIL_SMTP_USER,
    password: env.EMAIL_SMTP_PASSWORD,
  },
} as const;
