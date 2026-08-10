import { getRefreshTokenExpiresAt } from "../../../config/cookie.js";
import { ApiError } from "../../../lib/api-error.js";
import { generateOpaqueToken, hashToken } from "../../../lib/crypto.js";
import type { GitHubOAuthClient } from "./github.oauth.js";
import type { OAuthRepository } from "./oauth.repository.js";

const STATE_LIFETIME_MS = 10 * 60 * 1_000;

export class GitHubOAuthService {
  constructor(
    private readonly repository: OAuthRepository,
    private readonly client: GitHubOAuthClient,
  ) {}

  async start(redirectUri: string, linkUserId?: string): Promise<string> {
    const state = generateOpaqueToken();
    await this.repository.createState({
      provider: "GITHUB",
      intent: linkUserId ? "LINK" : "LOGIN",
      userId: linkUserId ?? null,
      stateHash: hashToken(state),
      expiresAt: new Date(Date.now() + STATE_LIFETIME_MS),
    });
    return this.client.getAuthorizationUrl(state, redirectUri);
  }

  async complete(
    code: string,
    state: string,
    redirectUri: string,
  ): Promise<{ intent: "login"; refreshToken: string } | { intent: "link" }> {
    const oauthState = await this.repository.consumeState("GITHUB", hashToken(state), new Date());
    if (!oauthState) throw new ApiError(400, "BAD_REQUEST", "OAuth state is invalid or expired.");
    const profile = await this.client.exchangeCode(code, redirectUri);
    if (!profile.emailVerified)
      throw new ApiError(403, "FORBIDDEN", "GitHub account email is not verified.");
    if (oauthState.intent === "LINK") {
      if (!oauthState.userId)
        throw new ApiError(400, "BAD_REQUEST", "OAuth link state is invalid.");
      const result = await this.repository.linkAccount({
        userId: oauthState.userId,
        provider: "GITHUB",
        providerAccountId: profile.providerAccountId,
        email: profile.email,
      });
      if (result === "missing-user")
        throw new ApiError(401, "UNAUTHORIZED", "Authentication is required.");
      if (result === "account-owned-by-another-user")
        throw new ApiError(409, "CONFLICT", "This GitHub account is already connected.");
      if (result === "provider-already-linked")
        throw new ApiError(409, "CONFLICT", "A GitHub account is already connected.");
      return { intent: "link" };
    }
    const user = await this.repository.resolveUser({
      provider: "GITHUB",
      providerAccountId: profile.providerAccountId,
      email: profile.email,
      name: profile.name,
      verifiedAt: new Date(),
    });
    const refreshToken = generateOpaqueToken();
    await this.repository.createRefreshSession({
      userId: user.userId,
      tokenHash: hashToken(refreshToken),
      expiresAt: getRefreshTokenExpiresAt(),
    });
    return { intent: "login", refreshToken };
  }
}
