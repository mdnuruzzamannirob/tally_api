import nodemailer from "nodemailer";

import { emailConfig } from "../../core/config/email.config.js";
import type { EmailMessage, EmailProvider } from "../email.types.js";
import { reportDeliveryFailure } from "./provider.utils.js";

export class SmtpEmailProvider implements EmailProvider {
  async send(message: EmailMessage): Promise<void> {
    const transport = nodemailer.createTransport({
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
      host: emailConfig.smtp.host,
      port: emailConfig.smtp.port,
      secure: emailConfig.smtp.secure,
      auth: { user: emailConfig.smtp.user, pass: emailConfig.smtp.password },
    });
    try {
      await transport.sendMail({
        from: emailConfig.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        ...(message.text ? { text: message.text } : {}),
      });
    } catch (error) {
      reportDeliveryFailure("smtp", error);
    }
  }
}
