import { z } from "zod";

const applicationStatuses = [
  "WISHLIST",
  "APPLIED",
  "SCREENING",
  "INTERVIEW",
  "OFFER",
  "REJECTED",
  "WITHDRAWN",
] as const;
const interviewTypes = ["PHONE", "TECHNICAL", "HR", "SYSTEM_DESIGN", "ONSITE", "OTHER"] as const;
const interviewStatuses = ["SCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW"] as const;
const ref = z.string().trim().min(1).max(100);
const text = (max: number) => z.string().trim().min(1).max(max);
const nullableText = (max: number) => text(max).nullable();
const isoTimestamp = z
  .string()
  .datetime({ offset: true })
  .transform((value) => new Date(value));
const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .transform((value) => new Date(`${value}T00:00:00.000Z`));
const nullableCalendarDate = calendarDate.nullable();
const nullableTimestamp = isoTimestamp.nullable();
const decimal = z.union([z.number().finite().nonnegative(), z.string().regex(/^\d+(\.\d+)?$/)]);
const nullableDecimal = decimal.nullable();
const httpUrl = z
  .string()
  .url()
  .refine((value) => ["http:", "https:"].includes(new URL(value).protocol));
const timeZone = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .refine((value) => {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "Invalid IANA time zone.");

const tagSchema = z.object({
  ref,
  name: text(50).transform((value) => value.toLowerCase()),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable(),
});
const noteSchema = z.object({
  content: text(5000),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
});
const interviewSchema = z.object({
  type: z.enum(interviewTypes),
  scheduledAt: isoTimestamp,
  interviewerName: nullableText(100),
  meetingLink: httpUrl.nullable(),
  location: nullableText(120),
  notes: nullableText(5000),
  status: z.enum(interviewStatuses),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
});
const historySchema = z.object({
  fromStatus: z.enum(applicationStatuses),
  toStatus: z.enum(applicationStatuses),
  note: nullableText(5000),
  changedAt: isoTimestamp,
});

const applicationSchema = z
  .object({
    ref,
    company: text(100),
    role: text(100),
    jobUrl: httpUrl.nullable(),
    location: nullableText(120),
    remoteType: z.enum(["ONSITE", "REMOTE", "HYBRID"]).nullable(),
    employmentType: z.enum(["FULL_TIME", "CONTRACT", "INTERNSHIP"]).nullable(),
    source: nullableText(100),
    status: z.enum(applicationStatuses),
    appliedAt: nullableCalendarDate,
    salaryMin: nullableDecimal,
    salaryMax: nullableDecimal,
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .nullable(),
    nextFollowUpAt: nullableTimestamp,
    archivedAt: nullableTimestamp,
    createdAt: isoTimestamp,
    updatedAt: isoTimestamp,
    tagRefs: z.array(ref).max(100),
    notes: z.array(noteSchema),
    interviews: z.array(interviewSchema),
    statusHistory: z.array(historySchema),
  })
  .superRefine((application, context) => {
    if (
      (application.salaryMin !== null || application.salaryMax !== null) &&
      !application.currency
    ) {
      context.addIssue({
        code: "custom",
        path: ["currency"],
        message: "Currency is required with salary.",
      });
    }
    if (
      application.salaryMin !== null &&
      application.salaryMax !== null &&
      Number(application.salaryMax) < Number(application.salaryMin)
    ) {
      context.addIssue({
        code: "custom",
        path: ["salaryMax"],
        message: "Salary maximum cannot be below salary minimum.",
      });
    }
    if (new Set(application.tagRefs).size !== application.tagRefs.length) {
      context.addIssue({
        code: "custom",
        path: ["tagRefs"],
        message: "Tag references must be unique.",
      });
    }
    let currentStatus = "WISHLIST";
    let previousChangedAt: Date | undefined;
    for (const [index, item] of application.statusHistory.entries()) {
      if (item.fromStatus !== currentStatus || item.toStatus === item.fromStatus) {
        context.addIssue({
          code: "custom",
          path: ["statusHistory", index],
          message: "Invalid status transition.",
        });
      }
      if (previousChangedAt && item.changedAt < previousChangedAt) {
        context.addIssue({
          code: "custom",
          path: ["statusHistory", index, "changedAt"],
          message: "Status history must be ordered.",
        });
      }
      currentStatus = item.toStatus;
      previousChangedAt = item.changedAt;
    }
    if (currentStatus !== application.status) {
      context.addIssue({
        code: "custom",
        path: ["statusHistory"],
        message: "Final history status must match application status.",
      });
    }
  });

export const importBackupSchema = z
  .object({
    version: z.literal(1),
    exportedAt: isoTimestamp,
    profile: z.object({
      name: nullableText(100),
      preferences: z.object({
        theme: z.enum(["LIGHT", "DARK", "SYSTEM"]),
        defaultLandingPage: z.enum(["DASHBOARD", "APPLICATIONS"]),
        timeZone,
        notificationsEnabled: z.boolean(),
      }),
    }),
    tags: z.array(tagSchema),
    applications: z.array(applicationSchema),
  })
  .superRefine((backup, context) => {
    if (new Set(backup.tags.map((tag) => tag.ref)).size !== backup.tags.length) {
      context.addIssue({
        code: "custom",
        path: ["tags"],
        message: "Tag references must be unique.",
      });
    }
    if (new Set(backup.tags.map((tag) => tag.name)).size !== backup.tags.length) {
      context.addIssue({ code: "custom", path: ["tags"], message: "Tag names must be unique." });
    }
    const tagRefs = new Set(backup.tags.map((tag) => tag.ref));
    for (const [index, application] of backup.applications.entries()) {
      if (application.tagRefs.some((tagRef) => !tagRefs.has(tagRef))) {
        context.addIssue({
          code: "custom",
          path: ["applications", index, "tagRefs"],
          message: "Tag reference does not exist.",
        });
      }
    }
    if (
      new Set(backup.applications.map((application) => application.ref)).size !==
      backup.applications.length
    ) {
      context.addIssue({
        code: "custom",
        path: ["applications"],
        message: "Application references must be unique.",
      });
    }
  });

export type ImportBackup = z.infer<typeof importBackupSchema>;
