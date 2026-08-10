import type { PrismaClient } from "../../generated/prisma/client.js";
import { ApiError } from "../../lib/api-error.js";
import type { CreateNoteInput, UpdateNoteInput } from "./note.validators.js";

export class NoteService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(userId: string, applicationId: string) {
    await this.requireApplication(userId, applicationId);
    return this.prisma.note.findMany({
      where: { applicationId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  }

  async create(userId: string, applicationId: string, input: CreateNoteInput) {
    await this.requireApplication(userId, applicationId);
    return this.prisma.note.create({ data: { applicationId, content: input.content } });
  }

  async update(userId: string, id: string, input: UpdateNoteInput) {
    const note = await this.prisma.note.findFirst({
      where: { id, application: { userId } },
      select: { id: true },
    });
    if (!note) throw new ApiError(404, "NOT_FOUND", "Note was not found.");
    return this.prisma.note.update({ where: { id }, data: { content: input.content } });
  }

  async delete(userId: string, id: string): Promise<void> {
    const note = await this.prisma.note.findFirst({
      where: { id, application: { userId } },
      select: { id: true },
    });
    if (!note) throw new ApiError(404, "NOT_FOUND", "Note was not found.");
    await this.prisma.note.delete({ where: { id } });
  }

  private async requireApplication(userId: string, applicationId: string): Promise<void> {
    const application = await this.prisma.application.findFirst({
      where: { id: applicationId, userId },
      select: { id: true },
    });
    if (!application) throw new ApiError(404, "NOT_FOUND", "Application was not found.");
  }
}
