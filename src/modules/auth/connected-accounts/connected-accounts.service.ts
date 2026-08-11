import { ApiError } from "../../../core/errors/api-error.js";
import type { ConnectedAccountsRepository } from "./connected-accounts.repository.js";

export class ConnectedAccountsService {
  constructor(private readonly repository: ConnectedAccountsRepository) {}

  async list(userId: string) {
    const user = await this.repository.findUser(userId);
    if (!user) throw new ApiError(401, "UNAUTHORIZED", "Authentication is required.");
    return {
      providers: (["GOOGLE", "GITHUB"] as const).map((provider) => {
        const account = user.oauthAccounts.find((item) => item.provider === provider);
        return {
          provider: provider.toLowerCase() as "google" | "github",
          connected: Boolean(account),
          email: account?.email ?? null,
        };
      }),
      hasPassword: Boolean(user.passwordHash),
    };
  }

  async unlink(userId: string, provider: "GOOGLE" | "GITHUB"): Promise<void> {
    const result = await this.repository.unlink(userId, provider);
    if (result.kind === "missing-user") {
      throw new ApiError(401, "UNAUTHORIZED", "Authentication is required.");
    }
    if (result.kind === "missing-account") {
      throw new ApiError(404, "NOT_FOUND", "Connected provider was not found.");
    }
    if (result.kind === "last-login-method") {
      throw new ApiError(409, "CONFLICT", "Cannot remove the last available login method");
    }
  }
}
