import type { UpdatePreferencesInput, UpdateProfileInput } from "../auth/auth.validators.js";
import type { UserRepository } from "./user.repository.js";
import type { PublicUser } from "./user.types.js";

function toPublicUser(user: {
  id: string;
  name: string | null;
  email: string;
  passwordHash: string | null;
  emailVerified: boolean;
  theme: string;
  defaultLandingPage: string;
  timeZone: string;
  notificationsEnabled: boolean;
  oauthAccounts: Array<{ provider: string }>;
}): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    hasPassword: Boolean(user.passwordHash),
    providers: user.oauthAccounts.map(({ provider }) => provider.toLowerCase()),
    preferences: {
      theme: user.theme.toLowerCase(),
      defaultLandingPage: user.defaultLandingPage.toLowerCase(),
      timeZone: user.timeZone,
      notificationsEnabled: user.notificationsEnabled,
    },
  };
}

export class UserService {
  constructor(private readonly repository: UserRepository) {}
  async updateProfile(userId: string, input: UpdateProfileInput): Promise<PublicUser> {
    return toPublicUser(await this.repository.updateProfile(userId, input.name));
  }
  async updatePreferences(userId: string, input: UpdatePreferencesInput): Promise<PublicUser> {
    return toPublicUser(await this.repository.updatePreferences(userId, input));
  }
}
