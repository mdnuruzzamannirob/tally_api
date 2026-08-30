export type OAuthProvider = "GOOGLE" | "GITHUB";
export type OAuthProviderSlug = "google" | "github";
export type OAuthIntent = "LOGIN" | "LINK";

export type OAuthProfile = {
  providerAccountId: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
};

export interface OAuthClient {
  getAuthorizationUrl(state: string, redirectUri: string): string;
  exchangeCode(code: string, redirectUri: string): Promise<OAuthProfile>;
}

export type OAuthResult =
  { intent: "login"; refreshToken: string; refreshTokenExpiresAt: Date } | { intent: "link" };
