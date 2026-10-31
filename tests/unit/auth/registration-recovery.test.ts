import { describe, expect, it, vi } from "vitest";

import { hashPassword } from "../../../src/core/security/password.js";
import { reportDeliveryFailure } from "../../../src/email/providers/provider.utils.js";
import type { AuthRepository } from "../../../src/modules/auth/auth.repository.js";
import type { EmailVerificationRepository } from "../../../src/modules/auth/verification/email-verification.repository.js";
import { EmailVerificationService } from "../../../src/modules/auth/verification/email-verification.service.js";

const input = { name: "Test User", email: "signup@example.test", password: "test-password" };

async function setup(verified = false) {
  const user = {
    id: "user-1",
    email: input.email,
    emailVerified: verified,
    passwordHash: await hashPassword(input.password),
  };
  const users = { findUserByEmail: vi.fn().mockResolvedValue(user) };
  const repository = {
    createUser: vi.fn(),
    replaceToken: vi.fn().mockResolvedValue(undefined),
    findToken: vi.fn(),
    verifyUser: vi.fn(),
  };
  const email = {
    sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: vi.fn(),
  };
  return {
    repository,
    email,
    service: new EmailVerificationService(
      users as unknown as AuthRepository,
      repository as unknown as EmailVerificationRepository,
      email,
    ),
  };
}

describe("registration delivery recovery", () => {
  it("retries verification without recreating or changing an unverified account", async () => {
    const { service, repository, email } = await setup();
    await service.register(input);
    expect(repository.createUser).not.toHaveBeenCalled();
    expect(repository.replaceToken).toHaveBeenCalledWith(
      "user-1",
      expect.any(String),
      expect.any(Date),
    );
    expect(email.sendVerificationEmail).toHaveBeenCalledWith({
      email: input.email,
      token: expect.any(String),
    });
  });

  it("rejects retries with a different password", async () => {
    const { service, repository, email } = await setup();
    await expect(
      service.register({ ...input, password: "different-password" }),
    ).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(repository.replaceToken).not.toHaveBeenCalled();
    expect(email.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("keeps verified accounts protected from registration retries", async () => {
    const { service, email } = await setup(true);
    await expect(service.register(input)).rejects.toMatchObject({ statusCode: 409 });
    expect(email.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("reports provider failures as a retryable service error", () => {
    try {
      reportDeliveryFailure("resend", new Error("private provider details"));
    } catch (error) {
      expect(error).toMatchObject({ statusCode: 503, code: "EMAIL_DELIVERY_FAILED" });
      expect((error as Error).message).not.toContain("private provider details");
      return;
    }
    throw new Error("Expected delivery failure");
  });
});
