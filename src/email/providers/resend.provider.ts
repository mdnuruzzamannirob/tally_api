import { emailConfig } from "../../core/config/email.config.js";
import type { EmailMessage, EmailProvider } from "../email.types.js";
import { deliver, requireEmailApiKey } from "./provider.utils.js";

export class ResendEmailProvider implements EmailProvider {
  send(message: EmailMessage): Promise<void> {
    const apiKey = requireEmailApiKey(emailConfig.apiKey);
    return deliver("resend", emailConfig.apiBaseUrl ?? "https://api.resend.com/emails", {
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: emailConfig.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
      }),
    });
  }
}
