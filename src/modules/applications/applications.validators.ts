import { z } from "zod";

const applicationStatus = z.enum([
  "WISHLIST",
  "APPLIED",
  "SCREENING",
  "INTERVIEW",
  "OFFER",
  "REJECTED",
  "WITHDRAWN",
]);
const remoteType = z.enum(["ONSITE", "REMOTE", "HYBRID"]);
const employmentType = z.enum(["FULL_TIME", "CONTRACT", "INTERNSHIP"]);

const optionalText = (max: number) => z.string().trim().min(1).max(max).optional();
const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format.")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Invalid date.");
const absoluteHttpUrl = z
  .string()
  .url()
  .refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  }, "URL must use http or https.");
const timestamp = z
  .string()
  .datetime({ offset: true })
  .transform((value) => new Date(value));

export const createApplicationSchema = z
  .object({
    company: z.string().trim().min(1).max(100),
    role: z.string().trim().min(1).max(100),
    jobUrl: absoluteHttpUrl.optional(),
    location: optionalText(120),
    remoteType: remoteType.optional(),
    employmentType: employmentType.optional(),
    source: optionalText(100),
    status: applicationStatus.optional(),
    appliedAt: calendarDate.optional(),
    salaryMin: z.number().finite().nonnegative().optional(),
    salaryMax: z.number().finite().nonnegative().optional(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/, "Currency must be three uppercase letters.")
      .optional(),
    nextFollowUpAt: timestamp.optional(),
    tagIds: z.array(z.string().trim().min(1)).max(100).optional(),
    initialNote: z.string().trim().min(1).max(5000).optional(),
  })
  .strict()
  .superRefine((input, context) => {
    if ((input.salaryMin !== undefined || input.salaryMax !== undefined) && !input.currency) {
      context.addIssue({
        code: "custom",
        path: ["currency"],
        message: "Currency is required with salary.",
      });
    }
    if (
      input.salaryMin !== undefined &&
      input.salaryMax !== undefined &&
      input.salaryMax < input.salaryMin
    ) {
      context.addIssue({
        code: "custom",
        path: ["salaryMax"],
        message: "Salary maximum cannot be below salary minimum.",
      });
    }
    if (input.tagIds && new Set(input.tagIds).size !== input.tagIds.length) {
      context.addIssue({ code: "custom", path: ["tagIds"], message: "Tag IDs must be unique." });
    }
  });

export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;

const nullable = <T extends z.ZodType>(schema: T) => schema.nullable().optional();

export const updateApplicationSchema = z
  .object({
    company: z.string().trim().min(1).max(100).optional(),
    role: z.string().trim().min(1).max(100).optional(),
    jobUrl: nullable(absoluteHttpUrl),
    location: nullable(z.string().trim().min(1).max(120)),
    remoteType: nullable(remoteType),
    employmentType: nullable(employmentType),
    source: nullable(z.string().trim().min(1).max(100)),
    appliedAt: nullable(calendarDate),
    salaryMin: nullable(z.number().finite().nonnegative()),
    salaryMax: nullable(z.number().finite().nonnegative()),
    currency: nullable(z.string().regex(/^[A-Z]{3}$/, "Currency must be three uppercase letters.")),
    nextFollowUpAt: nullable(timestamp),
    tagIds: z.array(z.string().trim().min(1)).max(100).optional(),
  })
  .strict()
  .refine(
    (input) => Object.values(input).some((value) => value !== undefined),
    "Provide at least one application field.",
  )
  .superRefine((input, context) => {
    if (
      typeof input.salaryMin === "number" &&
      typeof input.salaryMax === "number" &&
      input.salaryMax < input.salaryMin
    ) {
      context.addIssue({
        code: "custom",
        path: ["salaryMax"],
        message: "Salary maximum cannot be below salary minimum.",
      });
    }
    if (input.tagIds && new Set(input.tagIds).size !== input.tagIds.length) {
      context.addIssue({ code: "custom", path: ["tagIds"], message: "Tag IDs must be unique." });
    }
  });

export type UpdateApplicationInput = z.infer<typeof updateApplicationSchema>;

export const changeApplicationStatusSchema = z
  .object({
    toStatus: applicationStatus,
    note: z.string().trim().min(1).max(5000).optional(),
  })
  .strict();

export type ChangeApplicationStatusInput = z.infer<typeof changeApplicationStatusSchema>;

const positiveInteger = z.coerce.number().int().min(1);
const optionalTrimmedText = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() || undefined : value),
  z.string().trim().min(1).max(200).optional(),
);

export const listApplicationsQuerySchema = z
  .object({
    page: positiveInteger.default(1),
    pageSize: positiveInteger.max(100).default(20),
    search: optionalTrimmedText,
    status: applicationStatus.optional(),
    tag: optionalTrimmedText,
    remoteType: remoteType.optional(),
    employmentType: employmentType.optional(),
    source: optionalTrimmedText,
    appliedFrom: calendarDate.optional(),
    appliedTo: calendarDate.optional(),
    followUp: z.enum(["overdue", "today", "upcoming", "none"]).optional(),
    includeArchived: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    sort: z
      .enum(["updatedAt", "createdAt", "company", "role", "appliedAt", "nextFollowUpAt", "status"])
      .default("updatedAt"),
    order: z.enum(["asc", "desc"]).default("desc"),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.appliedFrom && input.appliedTo && input.appliedFrom > input.appliedTo) {
      context.addIssue({
        code: "custom",
        path: ["appliedTo"],
        message: "appliedTo cannot be before appliedFrom.",
      });
    }
  });

export type ListApplicationsQuery = z.infer<typeof listApplicationsQuerySchema>;
