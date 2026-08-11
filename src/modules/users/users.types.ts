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
