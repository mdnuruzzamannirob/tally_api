import { authConfig } from "../../../core/config/auth.config.js";
import { generateOpaqueToken, hashToken } from "../../../core/security/crypto.js";

export function createOAuthState(linkUserId?: string) {
  const state = generateOpaqueToken();
  return {
    state,
    record: {
      intent: linkUserId ? ("LINK" as const) : ("LOGIN" as const),
      userId: linkUserId ?? null,
      stateHash: hashToken(state),
      expiresAt: new Date(Date.now() + authConfig.oauthStateLifetimeMs),
    },
  };
}
