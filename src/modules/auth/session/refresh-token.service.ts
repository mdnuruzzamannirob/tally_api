import { getRefreshTokenExpiresAt } from "../../../core/config/cookie.config.js";
import { ApiError } from "../../../core/errors/api-error.js";
import { generateOpaqueToken, hashToken } from "../../../core/security/crypto.js";
import { createAccessToken } from "../../../core/security/jwt.js";
import type { SessionMetadata } from "../auth.types.js";
import type { RefreshTokenRepository } from "./refresh-token.repository.js";

export class RefreshTokenService {
  constructor(private readonly repository: RefreshTokenRepository) {}

  async create(userId: string, metadata: SessionMetadata): Promise<string> {
    const refreshToken = generateOpaqueToken();
    await this.repository.create({
      userId,
      tokenHash: hashToken(refreshToken),
      expiresAt: getRefreshTokenExpiresAt(),
      ...metadata,
    });
    return refreshToken;
  }

  async refresh(refreshToken: string, metadata: SessionMetadata) {
    const existing = await this.repository.find(hashToken(refreshToken));
    if (!existing || existing.expiresAt <= new Date()) {
      throw new ApiError(401, "UNAUTHORIZED", "Refresh token is invalid or expired.");
    }
    if (existing.revokedAt) {
      await this.repository.revokeAll(existing.userId, new Date());
      throw new ApiError(401, "UNAUTHORIZED", "Refresh token is invalid or expired.");
    }

    const nextRefreshToken = generateOpaqueToken();
    const rotated = await this.repository.rotate({
      id: existing.id,
      userId: existing.userId,
      nextTokenHash: hashToken(nextRefreshToken),
      // Rotation replaces the credential; it must not extend the session's
      // absolute lifetime.
      expiresAt: existing.expiresAt,
      revokedAt: new Date(),
      ...metadata,
    });
    if (!rotated) {
      await this.repository.revokeAll(existing.userId, new Date());
      throw new ApiError(401, "UNAUTHORIZED", "Refresh token is invalid or expired.");
    }
    return {
      accessToken: createAccessToken({
        sub: existing.userId,
        emailVerified: existing.user.emailVerified,
      }),
      refreshToken: nextRefreshToken,
      refreshTokenExpiresAt: existing.expiresAt,
    };
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (refreshToken) await this.repository.revoke(hashToken(refreshToken), new Date());
  }
}
