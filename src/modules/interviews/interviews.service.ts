import { ApiError } from "../../core/errors/api-error.js";
import type { InterviewRepository } from "./interviews.repository.js";
import type {
  CreateInterviewInput,
  InterviewListQuery,
  UpdateInterviewInput,
} from "./interviews.validators.js";

export class InterviewService {
  constructor(private readonly repository: InterviewRepository) {}

  async list(userId: string, query: InterviewListQuery, applicationId?: string) {
    const result = await this.repository.list(userId, query, new Date(), applicationId);
    if (result.kind === "application-not-found") {
      throw new ApiError(404, "NOT_FOUND", "Application was not found.");
    }
    return result;
  }

  async create(userId: string, applicationId: string, input: CreateInterviewInput) {
    const result = await this.repository.create(userId, applicationId, input);
    if (result.kind === "application-not-found")
      throw new ApiError(404, "NOT_FOUND", "Application was not found.");
    return result.interview;
  }

  async update(userId: string, id: string, input: UpdateInterviewInput) {
    const result = await this.repository.update(userId, id, input);
    if (result.kind === "not-found")
      throw new ApiError(404, "NOT_FOUND", "Interview was not found.");
    return result.interview;
  }

  async delete(userId: string, id: string): Promise<void> {
    if (!(await this.repository.delete(userId, id)))
      throw new ApiError(404, "NOT_FOUND", "Interview was not found.");
  }
}
