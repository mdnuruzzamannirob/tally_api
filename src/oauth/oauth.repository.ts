import type { PrismaClient } from "../generated/prisma/client.js";

/** Shared persistence boundary for provider state, accounts, and OAuth sessions. */
export class OAuthRepository {
  constructor(readonly client: PrismaClient) {}
}
