import type { PrismaClient } from "../../generated/prisma/client.js";

/** User persistence boundary; profile/preferences migrate here in Phase 1. */
export class UserRepository {
  constructor(readonly client: PrismaClient) {}
}
