import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(8, "Password must contain at least 8 characters.")
  .refine((value) => Buffer.byteLength(value, "utf8") <= 72, "Password must not exceed 72 bytes.");

export const forgotPasswordSchema = z.object({ email: z.string().trim().toLowerCase().email() });

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(1),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: passwordSchema,
  newPassword: passwordSchema,
});

export const setPasswordSchema = z.object({ newPassword: passwordSchema });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
