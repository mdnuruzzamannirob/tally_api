import { afterEach, describe, expect, it, vi } from "vitest";
import {
  NotificationService,
  escapeHtml,
} from "../../../src/modules/notifications/notifications.service.js";
import type { NotificationRepository } from "../../../src/modules/notifications/notifications.repository.js";

function setup(required: boolean, optedIn: boolean, attempts = 1) {
  const repository = {
    isRelevant: vi.fn().mockResolvedValue(true),
    collectReminders: vi.fn(),
    claim: vi.fn().mockResolvedValue([
      {
        id: "notification-1",
        title: "<script>",
        body: 'Company & "role"',
        href: "/settings",
        required,
        attempts,
        user: { email: "test@example.test", emailVerified: true, notificationsEnabled: optedIn },
      },
    ]),
    finish: vi.fn(),
  };
  const provider = { send: vi.fn().mockResolvedValue({ id: "email-1" }) };
  return {
    repository,
    provider,
    service: new NotificationService(repository as unknown as NotificationRepository, provider),
  };
}
describe("notification delivery policy", () => {
  afterEach(() => vi.useRealTimers());
  it("does not send stale reminders or unverified-account mail", async () => {
    const stale = setup(false, true);
    stale.repository.isRelevant.mockResolvedValue(false);
    await stale.service.run();
    expect(stale.provider.send).not.toHaveBeenCalled();
    expect(stale.repository.finish).toHaveBeenCalledWith("notification-1", "SKIPPED");
    const unverified = setup(true, true);
    const jobs = await unverified.repository.claim();
    jobs[0]!.user.emailVerified = false;
    await unverified.service.run();
    expect(unverified.provider.send).not.toHaveBeenCalled();
    expect(unverified.repository.finish).toHaveBeenCalledWith("notification-1", "SKIPPED");
  });
  it("persists the exact exponential retry deadline with the same delivery key", async () => {
    vi.useFakeTimers();
    const now = new Date("2030-01-01T00:00:00.000Z");
    vi.setSystemTime(now);
    const { service, repository, provider } = setup(false, true, 2);
    provider.send.mockRejectedValue(new Error("temporary provider failure"));
    await service.run();
    expect(repository.finish).toHaveBeenCalledWith(
      "notification-1",
      "PENDING",
      new Date(now.getTime() + 240_000),
    );
    expect(provider.send).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: "notification-1" }),
    );
  });
  it("honors opt-out for optional emails", async () => {
    const { service, repository, provider } = setup(false, false);
    await service.run();
    expect(provider.send).not.toHaveBeenCalled();
    expect(repository.finish).toHaveBeenCalledWith("notification-1", "SKIPPED");
  });
  it("sends mandatory security alerts with escaped HTML and a stable key", async () => {
    const { service, repository, provider } = setup(true, false);
    await service.run();
    expect(provider.send).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: "notification-1",
        html: expect.stringContaining("&lt;script&gt;"),
      }),
    );
    expect(repository.finish).toHaveBeenCalledWith(
      "notification-1",
      "ACCEPTED",
      undefined,
      "email-1",
    );
    expect(escapeHtml('a&b"<>')).toBe("a&amp;b&quot;&lt;&gt;");
  });
  it("schedules failed emails for retry and eventually stops", async () => {
    const first = setup(false, true);
    first.provider.send.mockRejectedValue(new Error("private error"));
    await first.service.run();
    expect(first.repository.finish).toHaveBeenCalledWith(
      "notification-1",
      "PENDING",
      expect.any(Date),
    );
    const last = setup(false, true, 5);
    last.provider.send.mockRejectedValue(new Error("private error"));
    await last.service.run();
    expect(last.repository.finish).toHaveBeenCalledWith(
      "notification-1",
      "FAILED",
      expect.any(Date),
    );
  });
});
