import type { PrismaClient } from "../../generated/prisma/client.js";
import { ApiError } from "../../utils/api-error.js";

export class ExportService {
  constructor(private readonly prisma: PrismaClient) {}

  async exportJson(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        theme: true,
        defaultLandingPage: true,
        timeZone: true,
        notificationsEnabled: true,
        tags: {
          orderBy: [{ name: "asc" }, { id: "asc" }],
          select: { id: true, name: true, color: true },
        },
        applications: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: {
            id: true,
            company: true,
            role: true,
            jobUrl: true,
            location: true,
            remoteType: true,
            employmentType: true,
            source: true,
            status: true,
            appliedAt: true,
            salaryMin: true,
            salaryMax: true,
            currency: true,
            nextFollowUpAt: true,
            archivedAt: true,
            createdAt: true,
            updatedAt: true,
            tags: { orderBy: { tagId: "asc" }, select: { tagId: true } },
            notes: {
              orderBy: [{ createdAt: "asc" }, { id: "asc" }],
              select: { content: true, createdAt: true, updatedAt: true },
            },
            interviews: {
              orderBy: [{ scheduledAt: "asc" }, { id: "asc" }],
              select: {
                type: true,
                scheduledAt: true,
                interviewerName: true,
                meetingLink: true,
                location: true,
                notes: true,
                status: true,
                createdAt: true,
                updatedAt: true,
              },
            },
            statusHistory: {
              orderBy: [{ changedAt: "asc" }, { id: "asc" }],
              select: { fromStatus: true, toStatus: true, note: true, changedAt: true },
            },
          },
        },
      },
    });
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
}
