import { createHash } from "node:crypto";
import { emailConfig } from "../../core/config/email.config.js";
import type { EmailMessage, EmailProvider, EmailReceipt } from "../email.types.js";
import { deliver, requireEmailApiKey } from "./provider.utils.js";

export class ResendEmailProvider implements EmailProvider {
  send(message: EmailMessage): Promise<EmailReceipt> {
    const apiKey = requireEmailApiKey(emailConfig.apiKey);
    return deliver("resend", emailConfig.apiBaseUrl ?? "https://api.resend.com/emails", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key":
          message.idempotencyKey ??
          createHash("sha256").update(JSON.stringify(message)).digest("hex"),
      },
      body: JSON.stringify({
        from: emailConfig.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
      }),
    });
  }
}
