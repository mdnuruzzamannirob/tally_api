import type { PrismaClient } from "../../generated/prisma/client.js";
import type { EmailService } from "../../email/email.service.js";
import { ApiError } from "../../utils/api-error.js";
import { hashPassword } from "../../auth/password.js";
import { generateOpaqueToken, hashToken } from "../../auth/tokens.js";
import type { RegisterInput } from "./auth.validators.js";

const VERIFICATION_TOKEN_LIFETIME_MS = 24 * 60 * 60 * 1_000;

export class AuthService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly emailService: EmailService,
  ) {}

  async register(input: RegisterInput): Promise<void> {
    const existingUser = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existingUser)
      throw new ApiError(409, "CONFLICT", "An account with this email already exists.");

    const passwordHash = await hashPassword(input.password);
    const rawToken = generateOpaqueToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_LIFETIME_MS);

    await this.prisma.$transaction(async (transaction) => {
      const user = await transaction.user.create({
        data: { name: input.name ?? null, email: input.email, passwordHash },
      });
      await transaction.emailVerificationToken.create({
        data: { userId: user.id, tokenHash, expiresAt },
      });
    });

    await this.emailService.sendVerificationEmail({ email: input.email, token: rawToken });
  }

  async verifyEmail(rawToken: string): Promise<void> {
    const token = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash: hashToken(rawToken) },
    });
    if (!token || token.expiresAt <= new Date()) {
      throw new ApiError(
        400,
        "INVALID_OR_EXPIRED_TOKEN",
        "Verification token is invalid or expired.",
      );
    }

    const verifiedAt = new Date();
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: token.userId },
        data: { emailVerified: true, emailVerifiedAt: verifiedAt },
      }),
      this.prisma.emailVerificationToken.deleteMany({ where: { userId: token.userId } }),
    ]);
  }

  async resendVerificationEmail(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.emailVerified) return;

    const rawToken = generateOpaqueToken();
    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } }),
      this.prisma.emailVerificationToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(rawToken),
          expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_LIFETIME_MS),
        },
      }),
    ]);

    await this.emailService.sendVerificationEmail({ email: user.email, token: rawToken });
  }
}
