import express from "express";
import { sign } from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it } from "vitest";

import {
  AccessTokenExpiredError,
  InvalidAccessTokenError,
  createAccessToken,
  verifyAccessToken,
} from "../../src/lib/jwt.js";
import { hashPassword, verifyPassword } from "../../src/lib/password.js";
import {
  REFRESH_COOKIE_NAME,
  getRefreshCookieOptions,
  setRefreshCookie,
} from "../../src/config/cookie.js";
import { generateOpaqueToken, hashToken } from "../../src/lib/crypto.js";
import { errorMiddleware } from "../../src/middleware/error.middleware.js";
import { authenticate } from "../../src/middleware/auth.middleware.js";
import { requireRefreshRequestOrigin } from "../../src/middleware/refresh-origin.middleware.js";
import { requireVerifiedUser } from "../../src/middleware/verified-user.middleware.js";
import { getPagination } from "../../src/lib/pagination.js";

const testSecret = "unit-test-signing-secret";

describe("auth primitives", () => {
  it("hashes passwords and creates opaque hashed tokens", async () => {
    const passwordHash = await hashPassword("safe-test-password");
    expect(passwordHash).not.toBe("safe-test-password");
    await expect(verifyPassword("safe-test-password", passwordHash)).resolves.toBe(true);
    await expect(verifyPassword("incorrect-password", passwordHash)).resolves.toBe(false);

    const token = generateOpaqueToken();
    expect(token).toHaveLength(43);
    expect(hashToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashToken(token)).not.toBe(token);
  });

  it("creates valid access JWTs and rejects invalid or expired tokens", () => {
    const token = createAccessToken({ sub: "user-1", emailVerified: true }, testSecret, "15m");
    expect(verifyAccessToken(token, testSecret)).toEqual({
      sub: "user-1",
      emailVerified: true,
      type: "access",
    });
    expect(() => verifyAccessToken(token, "different-secret")).toThrow(InvalidAccessTokenError);

    const expiredToken = sign({ sub: "user-1", emailVerified: true, type: "access" }, testSecret, {
      expiresIn: -1,
    });
    expect(() => verifyAccessToken(expiredToken, testSecret)).toThrow(AccessTokenExpiredError);
  });

  it("uses secure refresh-cookie settings", async () => {
    expect(getRefreshCookieOptions()).toMatchObject({
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/api/v1/auth",
      maxAge: 604_800_000,
    });

    const app = express();
    app.get("/cookie", (_request, response) =>
      setRefreshCookie(response, "token-value").sendStatus(204),
    );
    const response = await request(app).get("/cookie");
    expect(response.headers["set-cookie"]?.[0]).toContain(`${REFRESH_COOKIE_NAME}=`);
    expect(response.headers["set-cookie"]?.[0]).toContain("HttpOnly");
    expect(response.headers["set-cookie"]?.[0]).toContain("Path=/api/v1/auth");
  });

  it("enforces authentication, verified users, and refresh request origin", async () => {
    const accessToken = createAccessToken({ sub: "user-1", emailVerified: true });
    const unverifiedToken = createAccessToken({ sub: "user-2", emailVerified: false });
    const app = express();
    app.get("/protected", authenticate, requireVerifiedUser, (request, response) => {
      response.json({ userId: request.auth?.userId });
    });
    app.post("/refresh", requireRefreshRequestOrigin, (_request, response) =>
      response.sendStatus(204),
    );
    app.use(errorMiddleware);

    const unauthenticated = await request(app).get("/protected");
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.body.error.code).toBe("UNAUTHORIZED");
    await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${unverifiedToken}`)
      .expect(403);
    await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200, { userId: "user-1" });

    await request(app).post("/refresh").set("Origin", "https://not-allowed.example").expect(403);
    await request(app)
      .post("/refresh")
      .set("Origin", "http://localhost:3000")
      .set("X-Requested-With", "XMLHttpRequest")
      .expect(204);
  });

  it("calculates pagination within documented limits", () => {
    expect(getPagination({ page: 3, pageSize: 20 })).toEqual({
      page: 3,
      pageSize: 20,
      skip: 40,
      take: 20,
    });
    expect(() => getPagination({ page: 0 })).toThrow(RangeError);
    expect(() => getPagination({ pageSize: 101 })).toThrow(RangeError);
  });
});
