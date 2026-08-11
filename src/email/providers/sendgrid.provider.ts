import { emailConfig } from "../../core/config/email.config.js";
import type { EmailMessage, EmailProvider } from "../email.types.js";
import { deliver, requireEmailApiKey } from "./provider.utils.js";

export class SendGridEmailProvider implements EmailProvider {
  send(message: EmailMessage): Promise<void> {
    const apiKey = requireEmailApiKey(emailConfig.apiKey);
    return deliver("sendgrid", emailConfig.apiBaseUrl ?? "https://api.sendgrid.com/v3/mail/send", {
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: message.to }] }],
        from: { email: emailConfig.from },
        subject: message.subject,
        content: [{ type: "text/html", value: message.html }],
      }),
    });
  }
}
