import type { PrismaClient } from "../../generated/prisma/client.js";
import { ConnectedAccountsRepository } from "./connected-accounts/connected-accounts.repository.js";
import { PasswordResetRepository } from "./password/password-reset.repository.js";
import { RefreshTokenRepository } from "./session/refresh-token.repository.js";
import { EmailVerificationRepository } from "./verification/email-verification.repository.js";

export class AuthRepository {
  readonly connectedAccounts: ConnectedAccountsRepository;
  readonly passwords: PasswordResetRepository;
  readonly sessions: RefreshTokenRepository;
  readonly verification: EmailVerificationRepository;

  constructor(private readonly client: PrismaClient) {
    this.connectedAccounts = new ConnectedAccountsRepository(client);
    this.passwords = new PasswordResetRepository(client);
    this.sessions = new RefreshTokenRepository(client);
    this.verification = new EmailVerificationRepository(client);
  }

  findUserByEmail(email: string) {
    return this.client.user.findUnique({ where: { email }, include: { oauthAccounts: true } });
  }

  findUserById(userId: string) {
    return this.client.user.findUnique({ where: { id: userId }, include: { oauthAccounts: true } });
  }
}
