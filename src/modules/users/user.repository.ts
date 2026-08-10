import type { PrismaClient } from "../../generated/prisma/client.js";

/** User persistence boundary; profile/preferences migrate here in Phase 1. */
export class UserRepository {
  constructor(readonly client: PrismaClient) {}

  updateProfile(userId: string, name: string | undefined) {
    return this.client.user.update({ where: { id: userId }, data: { name: name ?? null }, include: { oauthAccounts: true } });
  }

  updatePreferences(userId: string, input: { theme?: "light" | "dark" | "system" | undefined; defaultLandingPage?: "dashboard" | "applications" | undefined; timeZone?: string | undefined; notificationsEnabled?: boolean | undefined }) {
    return this.client.user.update({ where: { id: userId }, data: {
      ...(input.theme ? { theme: input.theme.toUpperCase() as "LIGHT" | "DARK" | "SYSTEM" } : {}),
      ...(input.defaultLandingPage ? { defaultLandingPage: input.defaultLandingPage.toUpperCase() as "DASHBOARD" | "APPLICATIONS" } : {}),
      ...(input.timeZone ? { timeZone: input.timeZone } : {}),
      ...(input.notificationsEnabled !== undefined ? { notificationsEnabled: input.notificationsEnabled } : {}),
    }, include: { oauthAccounts: true } });
  }
}
