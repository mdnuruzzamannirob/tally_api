export const authConfig = {
  verificationTokenLifetimeMs: 24 * 60 * 60 * 1_000,
  passwordResetTokenLifetimeMs: 30 * 60 * 1_000,
  oauthStateLifetimeMs: 10 * 60 * 1_000,
} as const;
