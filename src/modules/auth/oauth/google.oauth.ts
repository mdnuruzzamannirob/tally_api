import { env } from "../../../config/env.js";
import { ApiError } from "../../../lib/api-error.js";

export interface GoogleProfile {
  providerAccountId: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
}

export interface GoogleOAuthClient {
  getAuthorizationUrl(state: string, redirectUri: string): string;
  exchangeCode(code: string, redirectUri: string): Promise<GoogleProfile>;
}

export class GoogleOAuthHttpClient implements GoogleOAuthClient {
  getAuthorizationUrl(state: string, redirectUri: string): string {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      throw new ApiError(503, "SERVICE_UNAVAILABLE", "Google sign-in is unavailable.");
    }
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", state);
    return url.toString();
  }

  async exchangeCode(code: string, redirectUri: string): Promise<GoogleProfile> {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      throw new ApiError(503, "SERVICE_UNAVAILABLE", "Google sign-in is unavailable.");
    }
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenResponse.ok) throw new ApiError(401, "UNAUTHORIZED", "Google sign-in failed.");
    const tokenData: unknown = await tokenResponse.json();
    const accessToken =
      typeof tokenData === "object" && tokenData !== null && "access_token" in tokenData
        ? (tokenData as { access_token?: unknown }).access_token
        : undefined;
    if (typeof accessToken !== "string")
      throw new ApiError(401, "UNAUTHORIZED", "Google sign-in failed.");

    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!profileResponse.ok) throw new ApiError(401, "UNAUTHORIZED", "Google sign-in failed.");
    const profile: unknown = await profileResponse.json();
    if (typeof profile !== "object" || profile === null) {
      throw new ApiError(401, "UNAUTHORIZED", "Google sign-in failed.");
    }
    const data = profile as Record<string, unknown>;
    if (
      typeof data.sub !== "string" ||
      typeof data.email !== "string" ||
      data.email_verified !== true
    ) {
      throw new ApiError(403, "FORBIDDEN", "Google account email is not verified.");
    }
    return {
      providerAccountId: data.sub,
      email: data.email.trim().toLowerCase(),
      emailVerified: true,
      name: typeof data.name === "string" ? data.name : null,
    };
  }
}
