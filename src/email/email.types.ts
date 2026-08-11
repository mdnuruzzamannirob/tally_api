export type EmailMessage = { to: string; subject: string; html: string };

export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}

export interface EmailService {
  sendVerificationEmail(input: { email: string; token: string }): Promise<void>;
  sendPasswordResetEmail(input: { email: string; token: string }): Promise<void>;
}
