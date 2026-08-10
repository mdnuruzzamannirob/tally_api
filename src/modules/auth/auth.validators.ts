import { z } from "zod";

const emailSchema = z.string().trim().toLowerCase().email();
const passwordSchema = z
  .string()
  .min(8, "Password must contain at least 8 characters.")
  .refine((value) => Buffer.byteLength(value, "utf8") <= 72, "Password must not exceed 72 bytes.");

export const registerSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  email: emailSchema,
  password: passwordSchema,
});

export const verifyEmailSchema = z.object({
  token: z.string().trim().min(1),
});

export const resendVerificationSchema = z.object({
  email: emailSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(1),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: passwordSchema,
  newPassword: passwordSchema,
});

export const setPasswordSchema = z.object({ newPassword: passwordSchema });

const updateNameSchema = z.string().trim().min(1).max(100);

export const updateProfileSchema = z
  .object({ name: updateNameSchema.optional() })
  .strict()
  .refine((input) => input.name !== undefined, "Provide at least one profile field.");

function isIanaTimeZone(value: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const updatePreferencesSchema = z
  .object({
    theme: z.enum(["light", "dark", "system"]).optional(),
    defaultLandingPage: z.enum(["dashboard", "applications"]).optional(),
    timeZone: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .refine(isIanaTimeZone, "Invalid IANA time zone.")
      .optional(),
    notificationsEnabled: z.boolean().optional(),
  })
  .strict()
  .refine(
    (input) => Object.values(input).some((value) => value !== undefined),
    "Provide at least one preference.",
  );

export type RegisterInput = z.infer<typeof registerSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
