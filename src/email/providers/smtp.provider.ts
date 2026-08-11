import nodemailer from "nodemailer";

import { emailConfig } from "../../core/config/email.config.js";
import type { EmailMessage, EmailProvider } from "../email.types.js";
import { reportDeliveryFailure } from "./provider.utils.js";

export class SmtpEmailProvider implements EmailProvider {
  async send(message: EmailMessage): Promise<void> {
    const transport = nodemailer.createTransport({
      host: emailConfig.smtp.host,
      port: emailConfig.smtp.port,
      secure: emailConfig.smtp.secure,
      auth: { user: emailConfig.smtp.user, pass: emailConfig.smtp.password },
    });
    try {
      await transport.sendMail({ from: emailConfig.from, ...message });
    } catch (error) {
      reportDeliveryFailure("smtp", error);
    }
  }
}
