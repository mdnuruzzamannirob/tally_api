import { logger } from "../../core/logger/logger.js";
import type { EmailMessage, EmailProvider } from "../email.types.js";

export class ConsoleEmailProvider implements EmailProvider {
  async send(message: EmailMessage): Promise<void> {
    const link = message.html.match(/href="([^"]+)"/)?.[1];
    logger.info(
      {
        event: "transactional_email_created",
        to: message.to,
        subject: message.subject,
        ...(link ? { link } : {}),
      },
      `Console email ready • To: ${message.to}${link ? ` • Link: ${link}` : ""}`,
    );
  }
}
