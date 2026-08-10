import { ApiError } from "../../lib/api-error.js";
import type { ExportRepository } from "./export.repository.js";

const csvColumns = [
  "company",
  "role",
  "status",
  "jobUrl",
  "location",
  "remoteType",
  "employmentType",
  "source",
  "appliedAt",
  "nextFollowUpAt",
  "salaryMin",
  "salaryMax",
  "currency",
  "tags",
  "createdAt",
  "updatedAt",
] as const;

function neutralizeCsvFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}
function escapeCsv(value: string | null): string {
  const normalized = value === null ? "" : neutralizeCsvFormula(value);
  return `"${normalized.replaceAll('"', '""')}"`;
}

export class ExportService {
  constructor(private readonly repository: ExportRepository) {}

  async exportJson(userId: string) {
    const user = await this.repository.getUserExportData(userId);
    if (!user) throw new ApiError(401, "UNAUTHORIZED", "Authentication is required.");
    const tagRefs = new Map(user.tags.map((tag, index) => [tag.id, `tag-${index + 1}`]));
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      profile: {
        name: user.name,
        preferences: {
          theme: user.theme,
          defaultLandingPage: user.defaultLandingPage,
          timeZone: user.timeZone,
          notificationsEnabled: user.notificationsEnabled,
        },
      },
      tags: user.tags.map((tag) => ({
        ref: tagRefs.get(tag.id),
        name: tag.name,
        color: tag.color,
      })),
      applications: user.applications.map((application, index) => ({
        ref: `application-${index + 1}`,
        company: application.company,
        role: application.role,
        jobUrl: application.jobUrl,
        location: application.location,
        remoteType: application.remoteType,
        employmentType: application.employmentType,
        source: application.source,
        status: application.status,
        appliedAt: application.appliedAt,
        salaryMin: application.salaryMin?.toString() ?? null,
        salaryMax: application.salaryMax?.toString() ?? null,
        currency: application.currency,
        nextFollowUpAt: application.nextFollowUpAt,
        archivedAt: application.archivedAt,
        createdAt: application.createdAt,
        updatedAt: application.updatedAt,
        tagRefs: application.tags.flatMap((assignment) => {
          const ref = tagRefs.get(assignment.tagId);
          return ref ? [ref] : [];
        }),
        notes: application.notes,
        interviews: application.interviews,
        statusHistory: application.statusHistory,
      })),
    };
  }

  async exportCsv(userId: string): Promise<string> {
    const applications = await this.repository.listCsvApplications(userId);
    const rows = applications.map((application) =>
      [
        application.company,
        application.role,
        application.status,
        application.jobUrl,
        application.location,
        application.remoteType,
        application.employmentType,
        application.source,
        application.appliedAt?.toISOString().slice(0, 10) ?? null,
        application.nextFollowUpAt?.toISOString() ?? null,
        application.salaryMin?.toString() ?? null,
        application.salaryMax?.toString() ?? null,
        application.currency,
        JSON.stringify(application.tags.map(({ tag }) => neutralizeCsvFormula(tag.name))),
        application.createdAt.toISOString(),
        application.updatedAt.toISOString(),
      ]
        .map(escapeCsv)
        .join(","),
    );
    return [csvColumns.join(","), ...rows].join("\r\n");
  }
}
