import { logger } from "../../core/logger/logger.js";
import { env } from "../../core/config/env.js";
import type { EmailProvider } from "../../email/email.types.js";
import type { NotificationInput, NotificationRepository } from "./notifications.repository.js";

export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!,
  );
}
export class NotificationService {
  constructor(
    private readonly repository: NotificationRepository,
    private readonly provider: EmailProvider,
  ) {}
  list(userId: string) {
    return this.repository.list(userId);
  }
  markRead(userId: string, id?: string) {
    return this.repository.markRead(userId, id);
  }
  async publish(input: NotificationInput) {
    await this.repository.create(input);
  }
  async run() {
    await this.repository.collectReminders(new Date());
    const jobs = await this.repository.claim(new Date());
    for (const job of jobs) {
      if (!(await this.repository.isRelevant(job.eventKey, new Date()))) {
        await this.repository.finish(job.id, "SKIPPED");
        continue;
      }
      if (!job.user.emailVerified || (!job.required && !job.user.notificationsEnabled)) {
        await this.repository.finish(job.id, "SKIPPED");
        continue;
      }
      try {
        const url = new URL(job.href, env.WEB_APP_URL).toString();
        const receipt = await this.provider.send({
          to: job.user.email,
          subject: job.title,
          idempotencyKey: job.id,
          html: `<h1>${escapeHtml(job.title)}</h1><p>${escapeHtml(job.body)}</p><p><a href="${escapeHtml(url)}">Open Tally</a></p>`,
        });
        await this.repository.finish(job.id, "ACCEPTED", undefined, receipt?.id);
      } catch {
        const failed = job.attempts >= 5;
        await this.repository.finish(
          job.id,
          failed ? "FAILED" : "PENDING",
          new Date(Date.now() + 60_000 * 2 ** job.attempts),
        );
        logger.warn(
          {
            event: "notification_delivery_retry",
            notificationId: job.id,
            attempts: job.attempts,
            failed,
          },
          "Notification email delivery failed",
        );
      }
    }
  }
}
