import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../src/core/errors/api-error.js";
import { errorMiddleware } from "../../../src/http/middleware/error-handler.middleware.js";
import { createAuthRouter } from "../../../src/modules/auth/auth.routes.js";
import type { AuthService } from "../../../src/modules/auth/auth.service.js";

function setup(failLogin = false) {
  const service = {
    register: vi.fn().mockResolvedValue(undefined),
    login: failLogin
      ? vi
          .fn()
          .mockRejectedValue(new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password."))
      : vi.fn().mockResolvedValue({ accessToken: "access", refreshToken: "refresh", user: {} }),
    logout: vi.fn().mockResolvedValue(undefined),
    requestPasswordReset: vi.fn().mockResolvedValue(undefined),
    resetPassword: vi.fn().mockResolvedValue(undefined),
    verifyEmail: vi.fn().mockResolvedValue(undefined),
    resendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  };
  const app = express();
  app.use(express.json());
  app.use("/auth", createAuthRouter(service as unknown as AuthService));
  app.use(errorMiddleware);
  return { app, service };
}
const credentials = { email: "person@example.test", password: "safe-test-password" };

describe("auth endpoint rate limits", () => {
  it("limits failed logins independently of other account actions", async () => {
    const { app, service } = setup(true);
    for (let index = 0; index < 10; index++)
      await request(app).post("/auth/login").send(credentials).expect(401);
    const blocked = await request(app).post("/auth/login").send(credentials).expect(429);
    expect(blocked.body.error.code).toBe("RATE_LIMITED");
    expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(0);
    expect(service.login).toHaveBeenCalledTimes(10);
    await request(app).post("/auth/register").send(credentials).expect(201);
    await request(app).post("/auth/forgot-password").send({ email: credentials.email }).expect(200);
    await request(app)
      .post("/auth/reset-password")
      .send({ token: "token", password: credentials.password })
      .expect(200);
    await request(app).post("/auth/verify-email").send({ token: "token" }).expect(200);
    await request(app)
      .post("/auth/logout")
      .set("Origin", "http://localhost:3000")
      .set("X-Requested-With", "XMLHttpRequest")
      .expect(200);
  });
  it("does not spend the failed-login budget on successful logins", async () => {
    const { app } = setup();
    for (let index = 0; index < 12; index++)
      await request(app).post("/auth/login").send(credentials).expect(200);
  });
  it("limits reset email requests independently of verification email requests", async () => {
    const { app, service } = setup();
    for (let index = 0; index < 5; index++)
      await request(app)
        .post("/auth/forgot-password")
        .send({ email: credentials.email })
        .expect(200);
    await request(app).post("/auth/forgot-password").send({ email: credentials.email }).expect(429);
    expect(service.requestPasswordReset).toHaveBeenCalledTimes(5);
    await request(app)
      .post("/auth/resend-verification")
      .send({ email: credentials.email })
      .expect(200);
  });
});
