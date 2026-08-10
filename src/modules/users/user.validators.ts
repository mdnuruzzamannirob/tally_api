import { z } from "zod";

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

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
