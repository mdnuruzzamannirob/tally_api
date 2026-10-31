import { emailConfig } from "../../core/config/email.config.js";
import type { EmailMessage, EmailProvider, EmailReceipt } from "../email.types.js";
import { deliver, requireEmailApiKey } from "./provider.utils.js";

export class BrevoEmailProvider implements EmailProvider {
  send(message: EmailMessage): Promise<EmailReceipt> {
    const apiKey = requireEmailApiKey(emailConfig.brevoApiKey);
    return deliver("brevo", "https://api.brevo.com/v3/smtp/email", {
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: { name: "Tally", email: emailConfig.from },
        to: [{ email: message.to }],
        subject: message.subject,
        htmlContent: message.html,
        ...(message.text ? { textContent: message.text } : {}),
      }),
    });
  }
}
