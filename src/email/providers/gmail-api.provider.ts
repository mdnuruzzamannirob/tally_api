import MailComposer from "nodemailer/lib/mail-composer/index.js";
import { emailConfig } from "../../core/config/email.config.js";
import type { EmailMessage, EmailProvider, EmailReceipt } from "../email.types.js";
import { deliver, reportDeliveryFailure } from "./provider.utils.js";

export class GmailApiProvider implements EmailProvider {
  private accessToken: string | undefined;
  private expiresAt = 0;
  private pending: Promise<string> | undefined;

  private async token(): Promise<string> {
    if (this.accessToken && Date.now() < this.expiresAt) return this.accessToken;
    this.pending ??= this.refresh().finally(() => {
      this.pending = undefined;
    });
    return this.pending;
  }

  private async refresh(): Promise<string> {
    const { clientId, clientSecret, refreshToken } = emailConfig.gmail;
    if (!clientId || !clientSecret || !refreshToken)
      reportDeliveryFailure("gmail", new Error("Missing credentials"));
    let response: Response;
    try {
      response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        signal: AbortSignal.timeout(10_000),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        }),
      });
    } catch (error) {
      reportDeliveryFailure("gmail", error);
    }
    const data = (await response.json().catch(() => null)) as {
      access_token?: unknown;
      expires_in?: unknown;
    } | null;
    if (!response.ok || typeof data?.access_token !== "string")
      reportDeliveryFailure("gmail", new Error("Token refresh failed"), {
        status: response.status,
      });
    this.accessToken = data.access_token;
    this.expiresAt =
      Date.now() +
      Math.max(0, (typeof data.expires_in === "number" ? data.expires_in : 3600) - 60) * 1000;
    return this.accessToken;
  }

  async send(message: EmailMessage): Promise<EmailReceipt> {
    const token = await this.token();
    const mime = await new MailComposer({
      from: emailConfig.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      ...(message.text ? { text: message.text } : {}),
    })
      .compile()
      .build();
    return deliver("gmail", "https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw: mime.toString("base64url") }),
    });
  }
}
