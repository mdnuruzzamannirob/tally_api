import { ApiError } from "../../core/errors/api-error.js";
import type { NoteRepository } from "./notes.repository.js";
import type { CreateNoteInput, UpdateNoteInput } from "./notes.validators.js";

export class NoteService {
  constructor(private readonly repository: NoteRepository) {}

  async list(userId: string, applicationId: string) {
    const result = await this.repository.list(userId, applicationId);
    if (result.kind === "application-not-found")
      throw new ApiError(404, "NOT_FOUND", "Application was not found.");
    return result.notes;
  }

  async create(userId: string, applicationId: string, input: CreateNoteInput) {
    const result = await this.repository.create(userId, applicationId, input);
    if (result.kind === "application-not-found")
      throw new ApiError(404, "NOT_FOUND", "Application was not found.");
    return result.note;
  }

  async update(userId: string, id: string, input: UpdateNoteInput) {
    const result = await this.repository.update(userId, id, input);
    if (result.kind === "not-found") throw new ApiError(404, "NOT_FOUND", "Note was not found.");
    return result.note;
  }

  async delete(userId: string, id: string): Promise<void> {
    if (!(await this.repository.delete(userId, id)))
      throw new ApiError(404, "NOT_FOUND", "Note was not found.");
  }
}
