import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import type { CreateNoteInput, UpdateNoteInput } from "./note.validators.js";

export type NoteApplicationResult =
  { kind: "application-not-found" } | { kind: "created"; note: Prisma.NoteGetPayload<object> };
export type NoteMutationResult =
  { kind: "not-found" } | { kind: "updated"; note: Prisma.NoteGetPayload<object> };

export class NoteRepository {
  constructor(private readonly client: PrismaClient) {}

  async list(userId: string, applicationId: string) {
    const application = await this.client.application.findFirst({
      where: { id: applicationId, userId },
      select: { id: true },
    });
    if (!application) return { kind: "application-not-found" as const };
    const notes = await this.client.note.findMany({
      where: { applicationId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return { kind: "listed" as const, notes };
  }

  async create(
    userId: string,
    applicationId: string,
    input: CreateNoteInput,
  ): Promise<NoteApplicationResult> {
    const application = await this.client.application.findFirst({
      where: { id: applicationId, userId },
      select: { id: true },
    });
    if (!application) return { kind: "application-not-found" };
    const note = await this.client.note.create({ data: { applicationId, content: input.content } });
    return { kind: "created", note };
  }

  async update(userId: string, id: string, input: UpdateNoteInput): Promise<NoteMutationResult> {
    const note = await this.client.note.findFirst({
      where: { id, application: { userId } },
      select: { id: true },
    });
    if (!note) return { kind: "not-found" };
    const updated = await this.client.note.update({
      where: { id },
      data: { content: input.content },
    });
    return { kind: "updated", note: updated };
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const note = await this.client.note.findFirst({
      where: { id, application: { userId } },
      select: { id: true },
    });
    if (!note) return false;
    await this.client.note.delete({ where: { id } });
    return true;
  }
}
