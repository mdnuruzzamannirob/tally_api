import type { PrismaClient } from "../../generated/prisma/client.js";

export class ExportRepository {
  constructor(private readonly client: PrismaClient) {}

  async getUserExportData(userId: string) {
    return this.client.user.findUnique({
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
  }

  async listCsvApplications(userId: string) {
    return this.client.application.findMany({
      where: { userId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        company: true,
        role: true,
        status: true,
        jobUrl: true,
        location: true,
        remoteType: true,
        employmentType: true,
        source: true,
        appliedAt: true,
        nextFollowUpAt: true,
        salaryMin: true,
        salaryMax: true,
        currency: true,
        createdAt: true,
        updatedAt: true,
        tags: { orderBy: { tag: { name: "asc" } }, select: { tag: { select: { name: true } } } },
      },
    });
  }
}
