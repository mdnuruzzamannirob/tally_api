import type { SessionMetadata } from "../auth.types.js";

export type CreateRefreshTokenInput = SessionMetadata & {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
};

export type RotateRefreshTokenInput = SessionMetadata & {
  id: string;
  userId: string;
  nextTokenHash: string;
  expiresAt: Date;
  revokedAt: Date;
};
