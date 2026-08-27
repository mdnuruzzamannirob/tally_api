import { getRefreshTokenExpiresAt } from "../../../core/config/cookie.config.js";
import { ApiError } from "../../../core/errors/api-error.js";
import { generateOpaqueToken, hashToken } from "../../../core/security/crypto.js";
import type { OAuthRepository } from "./oauth.repository.js";
import { createOAuthState } from "./oauth.state.js";
import type { OAuthClient, OAuthProvider, OAuthResult } from "./oauth.types.js";

export class OAuthService {
  constructor(
    readonly provider: OAuthProvider,
    private readonly repository: OAuthRepository,
    private readonly client: OAuthClient,
  ) {}

  async start(redirectUri: string, linkUserId?: string): Promise<string> {
    const { state, record } = createOAuthState(linkUserId);
    await this.repository.createState({
      provider: this.provider,
      ...record,
    });
    return this.client.getAuthorizationUrl(state, redirectUri);
  }

  async complete(code: string, state: string, redirectUri: string): Promise<OAuthResult> {
    const oauthState = await this.repository.consumeState(
      this.provider,
      hashToken(state),
      new Date(),
    );
    if (!oauthState) throw new ApiError(400, "BAD_REQUEST", "OAuth state is invalid or expired.");
    const profile = await this.client.exchangeCode(code, redirectUri);
    const providerName = this.provider === "GOOGLE" ? "Google" : "GitHub";
    if (!profile.emailVerified) {
      throw new ApiError(403, "FORBIDDEN", `${providerName} account email is not verified.`);
    }

    if (oauthState.intent === "LINK") {
      if (!oauthState.userId) {
        throw new ApiError(400, "BAD_REQUEST", "OAuth link state is invalid.");
      }
      const result = await this.repository.linkAccount({
        userId: oauthState.userId,
        provider: this.provider,
        providerAccountId: profile.providerAccountId,
        email: profile.email,
      });
      if (result === "missing-user") {
        throw new ApiError(401, "UNAUTHORIZED", "Authentication is required.");
      }
      if (result === "account-owned-by-another-user") {
        throw new ApiError(409, "CONFLICT", `This ${providerName} account is already connected.`);
      }
      if (result === "provider-already-linked") {
        throw new ApiError(409, "CONFLICT", `A ${providerName} account is already connected.`);
      }
      return { intent: "link" };
    }

    const user = await this.repository.resolveUser({
      provider: this.provider,
      providerAccountId: profile.providerAccountId,
      email: profile.email,
      name: profile.name,
      verifiedAt: new Date(),
    });
    const refreshToken = generateOpaqueToken();
    const refreshTokenExpiresAt = getRefreshTokenExpiresAt();
    await this.repository.createRefreshSession({
      userId: user.userId,
      tokenHash: hashToken(refreshToken),
      expiresAt: refreshTokenExpiresAt,
    });
    return { intent: "login", refreshToken, refreshTokenExpiresAt };
  }
}
