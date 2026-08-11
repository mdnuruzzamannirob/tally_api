import { emailConfig } from "../../core/config/email.config.js";
import type { EmailMessage, EmailProvider } from "../email.types.js";
import { deliver, requireEmailApiKey } from "./provider.utils.js";

export class MailgunEmailProvider implements EmailProvider {
  send(message: EmailMessage): Promise<void> {
    const apiKey = requireEmailApiKey(emailConfig.apiKey);
    const url =
      emailConfig.apiBaseUrl ?? `https://api.mailgun.net/v3/${emailConfig.mailgunDomain}/messages`;
    return deliver("mailgun", url, {
      headers: { Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}` },
      body: new URLSearchParams({
        from: emailConfig.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
      }),
    });
  }
}
