import { JsonWebTokenError, TokenExpiredError, sign, verify } from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";

import { env } from "../config/env.js";

export interface AccessTokenPayload {
  sub: string;
  emailVerified: boolean;
  type: "access";
}

export class AccessTokenExpiredError extends Error {}
export class InvalidAccessTokenError extends Error {}

export function createAccessToken(
  payload: Omit<AccessTokenPayload, "type">,
  secret = env.ACCESS_TOKEN_SECRET,
  expiresIn = env.ACCESS_TOKEN_EXPIRES_IN,
): string {
  const options: SignOptions = { expiresIn: expiresIn as Exclude<SignOptions["expiresIn"], undefined> };
  return sign({ ...payload, type: "access" }, secret, options);
}

export function verifyAccessToken(token: string, secret = env.ACCESS_TOKEN_SECRET): AccessTokenPayload {
  try {
    const payload = verify(token, secret);
    if (
      typeof payload === "string" ||
      typeof payload.sub !== "string" ||
      typeof payload.emailVerified !== "boolean" ||
      payload.type !== "access"
    ) {
      throw new InvalidAccessTokenError("Invalid access token payload.");
    }
    return { sub: payload.sub, emailVerified: payload.emailVerified, type: "access" };
  } catch (error) {
    if (error instanceof AccessTokenExpiredError || error instanceof InvalidAccessTokenError) throw error;
    if (error instanceof TokenExpiredError) throw new AccessTokenExpiredError("Access token has expired.");
    if (error instanceof JsonWebTokenError) throw new InvalidAccessTokenError("Invalid access token.");
    throw error;
  }
}
