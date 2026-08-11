import { z } from "zod";

const interviewType = z.enum(["PHONE", "TECHNICAL", "HR", "SYSTEM_DESIGN", "ONSITE", "OTHER"]);
const interviewStatus = z.enum(["SCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW"]);
const timestamp = z
  .string()
  .datetime({ offset: true })
  .transform((value) => new Date(value));
const httpUrl = z
  .string()
  .url()
  .refine(
    (value) => ["http:", "https:"].includes(new URL(value).protocol),
    "URL must use http or https.",
  );
const nullable = <T extends z.ZodType>(schema: T) => schema.nullable().optional();

export const createInterviewSchema = z
  .object({
    type: interviewType,
    scheduledAt: timestamp,
    interviewerName: z.string().trim().min(1).max(100).optional(),
    meetingLink: httpUrl.optional(),
    location: z.string().trim().min(1).max(120).optional(),
    notes: z.string().trim().min(1).max(5000).optional(),
    status: interviewStatus.optional(),
  })
  .strict();

export const updateInterviewSchema = z
  .object({
    type: interviewType.optional(),
    scheduledAt: timestamp.optional(),
    interviewerName: nullable(z.string().trim().min(1).max(100)),
    meetingLink: nullable(httpUrl),
    location: nullable(z.string().trim().min(1).max(120)),
    notes: nullable(z.string().trim().min(1).max(5000)),
    status: interviewStatus.optional(),
  })
  .strict()
  .refine(
    (input) => Object.values(input).some((value) => value !== undefined),
    "Provide at least one interview field.",
  );

export const interviewListQuerySchema = z
  .object({
    range: z.enum(["upcoming", "past"]).default("upcoming"),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    includeArchived: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
  })
  .strict();

export type CreateInterviewInput = z.infer<typeof createInterviewSchema>;
export type UpdateInterviewInput = z.infer<typeof updateInterviewSchema>;
export type InterviewListQuery = z.infer<typeof interviewListQuerySchema>;
