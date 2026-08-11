import { env } from "../../../../core/config/env.js";
import { ApiError } from "../../../../core/errors/api-error.js";

export interface GitHubProfile {
  providerAccountId: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
}

export interface GitHubOAuthClient {
  getAuthorizationUrl(state: string, redirectUri: string): string;
  exchangeCode(code: string, redirectUri: string): Promise<GitHubProfile>;
}

export class GitHubOAuthHttpClient implements GitHubOAuthClient {
  getAuthorizationUrl(state: string, redirectUri: string): string {
    if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
      throw new ApiError(503, "SERVICE_UNAVAILABLE", "GitHub sign-in is unavailable.");
    }
    const url = new URL("https://github.com/login/oauth/authorize");
    url.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", "read:user user:email");
    url.searchParams.set("state", state);
    return url.toString();
  }

  async exchangeCode(code: string, redirectUri: string): Promise<GitHubProfile> {
    if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
      throw new ApiError(503, "SERVICE_UNAVAILABLE", "GitHub sign-in is unavailable.");
    }
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        redirect_uri: redirectUri,
      }),
    });
    if (!tokenResponse.ok) throw new ApiError(401, "UNAUTHORIZED", "GitHub sign-in failed.");
    const tokenData: unknown = await tokenResponse.json();
    const accessToken =
      typeof tokenData === "object" && tokenData !== null && "access_token" in tokenData
        ? (tokenData as { access_token?: unknown }).access_token
        : undefined;
    if (typeof accessToken !== "string")
      throw new ApiError(401, "UNAUTHORIZED", "GitHub sign-in failed.");

    const headers = {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${accessToken}`,
    };
    const [profileResponse, emailsResponse] = await Promise.all([
      fetch("https://api.github.com/user", { headers }),
      fetch("https://api.github.com/user/emails", { headers }),
    ]);
    if (!profileResponse.ok || !emailsResponse.ok) {
      throw new ApiError(401, "UNAUTHORIZED", "GitHub sign-in failed.");
    }
    const profile: unknown = await profileResponse.json();
    const emails: unknown = await emailsResponse.json();
    if (typeof profile !== "object" || profile === null || !Array.isArray(emails)) {
      throw new ApiError(401, "UNAUTHORIZED", "GitHub sign-in failed.");
    }
    const profileData = profile as Record<string, unknown>;
    const verifiedEmail =
      emails.find(
        (entry): entry is { email: string; verified: true; primary?: boolean } =>
          typeof entry === "object" &&
          entry !== null &&
          typeof (entry as { email?: unknown }).email === "string" &&
          (entry as { verified?: unknown }).verified === true &&
          (entry as { primary?: unknown }).primary === true,
      ) ??
      emails.find(
        (entry): entry is { email: string; verified: true } =>
          typeof entry === "object" &&
          entry !== null &&
          typeof (entry as { email?: unknown }).email === "string" &&
          (entry as { verified?: unknown }).verified === true,
      );
    if (typeof profileData.id !== "number" || !verifiedEmail) {
      throw new ApiError(403, "FORBIDDEN", "GitHub account email is not verified.");
    }
    return {
      providerAccountId: String(profileData.id),
      email: verifiedEmail.email.trim().toLowerCase(),
      emailVerified: true,
      name: typeof profileData.name === "string" ? profileData.name : null,
    };
  }
}
