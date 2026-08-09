import { z } from "zod";

const nodeEnvironments = ["development", "test", "production"] as const;
const emailProviders = ["console", "resend", "sendgrid", "mailgun", "smtp"] as const;
const logLevels = ["trace", "debug", "info", "warn", "error", "fatal"] as const;
const sameSiteValues = ["lax", "strict", "none"] as const;

const durationSchema = z.string().regex(/^\d+[smhdw]$/, "Must be a duration such as 15m or 7d.");

const optionalString = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().min(1).optional(),
);

const booleanSchema = z.preprocess((value) => {
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}, z.boolean());

const databaseUrlSchema = z
  .string()
  .url()
  .refine(
    (value) => {
      const protocol = new URL(value).protocol;
      return protocol === "postgres:" || protocol === "postgresql:";
    },
    { message: "Must be a PostgreSQL connection URL." },
  );

const envSchema = z
  .object({
    NODE_ENV: z.enum(nodeEnvironments).default("development"),
    PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
    DATABASE_URL: databaseUrlSchema,
    TEST_DATABASE_URL: databaseUrlSchema.optional(),
    WEB_APP_URL: z.string().url(),
    ACCESS_TOKEN_SECRET: z.string().min(1),
    ACCESS_TOKEN_EXPIRES_IN: durationSchema.default("15m"),
    REFRESH_TOKEN_EXPIRES_IN: durationSchema.default("7d"),
    EMAIL_PROVIDER: z.enum(emailProviders).default("console"),
    EMAIL_API_KEY: optionalString,
    EMAIL_FROM: z.string().email(),
    GOOGLE_CLIENT_ID: optionalString,
    GOOGLE_CLIENT_SECRET: optionalString,
    GITHUB_CLIENT_ID: optionalString,
    GITHUB_CLIENT_SECRET: optionalString,
    COOKIE_SECURE: booleanSchema.default(false),
    COOKIE_SAME_SITE: z.enum(sameSiteValues).default("lax"),
    LOG_LEVEL: z.enum(logLevels).default("info"),
  })
  .superRefine((value, context) => {
    if (value.NODE_ENV !== "production") return;

    if (Buffer.byteLength(value.ACCESS_TOKEN_SECRET, "utf8") < 32) {
      context.addIssue({
        code: "custom",
        path: ["ACCESS_TOKEN_SECRET"],
        message: "Must contain at least 32 bytes in production.",
      });
    }
    if (value.EMAIL_PROVIDER === "console") {
      context.addIssue({
        code: "custom",
        path: ["EMAIL_PROVIDER"],
        message: "Console email is not allowed in production.",
      });
    } else if (!value.EMAIL_API_KEY) {
      context.addIssue({
        code: "custom",
        path: ["EMAIL_API_KEY"],
        message: "Required for the selected production email provider.",
      });
    }
    for (const key of [
      "GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET",
      "GITHUB_CLIENT_ID",
      "GITHUB_CLIENT_SECRET",
    ] as const) {
      if (!value[key])
        context.addIssue({ code: "custom", path: [key], message: "Required in production." });
    }
    if (!value.COOKIE_SECURE) {
      context.addIssue({
        code: "custom",
        path: ["COOKIE_SECURE"],
        message: "Must be true in production.",
      });
    }
    if (value.COOKIE_SAME_SITE !== "none") {
      context.addIssue({
        code: "custom",
        path: ["COOKIE_SAME_SITE"],
        message: "Must be none in production for the cross-origin web app.",
      });
    }
  });

export type Environment = z.infer<typeof envSchema>;

export function parseEnvironment(input: NodeJS.ProcessEnv): Environment {
  return envSchema.parse(input);
}
