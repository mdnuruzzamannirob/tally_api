import type { PrismaClient } from "../../generated/prisma/client.js";
import type { ImportBackup } from "./import.validators.js";

export class ImportRepository {
  constructor(private readonly client: PrismaClient) {}

  async replaceUserData(userId: string, backup: ImportBackup): Promise<void> {
    await this.client.$transaction(async (transaction) => {
      await transaction.application.deleteMany({ where: { userId } });
      await transaction.tag.deleteMany({ where: { userId } });
      await transaction.user.update({
        where: { id: userId },
        data: {
          name: backup.profile.name,
          theme: backup.profile.preferences.theme,
          defaultLandingPage: backup.profile.preferences.defaultLandingPage,
          timeZone: backup.profile.preferences.timeZone,
          notificationsEnabled: backup.profile.preferences.notificationsEnabled,
        },
      });
      const tagIds = new Map<string, string>();
      for (const tag of backup.tags) {
        const created = await transaction.tag.create({
          data: { userId, name: tag.name, ...(tag.color ? { color: tag.color } : {}) },
        });
        tagIds.set(tag.ref, created.id);
      }
      for (const application of backup.applications) {
        const created = await transaction.application.create({
          data: {
            userId,
            company: application.company,
            role: application.role,
            jobUrl: application.jobUrl,
            location: application.location,
            remoteType: application.remoteType,
            employmentType: application.employmentType,
            source: application.source,
            status: application.status,
            appliedAt: application.appliedAt,
            salaryMin: application.salaryMin,
            salaryMax: application.salaryMax,
            currency: application.currency,
            nextFollowUpAt: application.nextFollowUpAt,
            archivedAt: application.archivedAt,
            createdAt: application.createdAt,
            updatedAt: application.updatedAt,
          },
        });
        if (application.tagRefs.length)
          await transaction.applicationTag.createMany({
            data: application.tagRefs.map((tagRef) => ({
              applicationId: created.id,
              tagId: tagIds.get(tagRef)!,
            })),
          });
        if (application.notes.length)
          await transaction.note.createMany({
            data: application.notes.map((note) => ({
              applicationId: created.id,
              content: note.content,
              createdAt: note.createdAt,
              updatedAt: note.updatedAt,
            })),
          });
        if (application.interviews.length)
          await transaction.interview.createMany({
            data: application.interviews.map((interview) => ({
              applicationId: created.id,
              type: interview.type,
              scheduledAt: interview.scheduledAt,
              interviewerName: interview.interviewerName,
              meetingLink: interview.meetingLink,
              location: interview.location,
              notes: interview.notes,
              status: interview.status,
              createdAt: interview.createdAt,
              updatedAt: interview.updatedAt,
            })),
          });
        if (application.statusHistory.length)
          await transaction.statusHistory.createMany({
            data: application.statusHistory.map((history) => ({
              applicationId: created.id,
              fromStatus: history.fromStatus,
              toStatus: history.toStatus,
              note: history.note,
              changedAt: history.changedAt,
            })),
          });
      }
    });
  }
}
