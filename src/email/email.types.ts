export type EmailMessage = { to: string; subject: string; html: string; idempotencyKey?: string };

export type EmailReceipt = void | { id: string };

export interface EmailProvider {
  send(message: EmailMessage): Promise<EmailReceipt>;
}

export interface EmailService {
  sendVerificationEmail(input: { email: string; token: string }): Promise<void>;
  sendPasswordResetEmail(input: { email: string; token: string }): Promise<void>;
}
