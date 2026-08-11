import { logger } from "../../core/logger/logger.js";
import type { EmailMessage, EmailProvider } from "../email.types.js";

export class ConsoleEmailProvider implements EmailProvider {
  async send(message: EmailMessage): Promise<void> {
    void message;
    logger.info({ event: "transactional_email_created" }, "Transactional email created");
  }
}
