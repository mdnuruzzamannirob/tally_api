import { ApiError } from "../../core/errors/api-error.js";
import { buildApplicationsCsv } from "./csv/csv-export.service.js";
import type { ExportRepository } from "./export-import.repository.js";

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
    return buildApplicationsCsv(applications);
  }
}
