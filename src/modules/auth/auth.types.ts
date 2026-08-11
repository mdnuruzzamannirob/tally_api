export type PublicUser = {
  id: string;
  name: string | null;
  email: string;
  emailVerified: boolean;
  hasPassword: boolean;
  providers: string[];
  preferences: {
    theme: string;
    defaultLandingPage: string;
    timeZone: string;
    notificationsEnabled: boolean;
  };
};

export type SessionMetadata = { userAgent: string | undefined; ip: string | undefined };

export type AuthUserRecord = {
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
};

export function toPublicUser(user: AuthUserRecord): PublicUser {
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
