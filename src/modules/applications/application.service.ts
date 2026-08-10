import { ApiError } from "../../lib/api-error.js";
import type { ApplicationRepository } from "./application.repository.js";
import type {
  ChangeApplicationStatusInput,
  CreateApplicationInput,
  ListApplicationsQuery,
  UpdateApplicationInput,
} from "./application.validators.js";

function dayBounds(timeZone: string): { start: Date; end: Date } {
  const dateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts();
  const values = Object.fromEntries(
    dateParts.filter(({ type }) => type !== "literal").map(({ type, value }) => [type, value]),
  );
  const localDate = `${values.year}-${values.month}-${values.day}`;
  const noon = new Date(`${localDate}T12:00:00.000Z`);
  const offsetName = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
    .formatToParts(noon)
    .find(({ type }) => type === "timeZoneName")?.value;
  const offsetMatch = offsetName?.match(/^GMT([+-])(\d{2}):(\d{2})$/);
  const offsetMinutes = offsetMatch
    ? (Number(offsetMatch[2]) * 60 + Number(offsetMatch[3])) * (offsetMatch[1] === "+" ? 1 : -1)
    : 0;
  const start = new Date(Date.parse(`${localDate}T00:00:00.000Z`) - offsetMinutes * 60_000);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60_000) };
}

export class ApplicationService {
  constructor(private readonly repository: ApplicationRepository) {}

  async create(userId: string, input: CreateApplicationInput) {
    const result = await this.repository.create(userId, input);
    if (result.kind === "invalid-tags")
      throw new ApiError(400, "BAD_REQUEST", "One or more tags are invalid.");
    return result.application;
  }

  async getById(userId: string, id: string) {
    const application = await this.repository.getById(userId, id);
    if (!application) throw new ApiError(404, "NOT_FOUND", "Application was not found.");
    return application;
  }

  async list(userId: string, query: ListApplicationsQuery) {
    const timeZone = query.followUp
      ? ((await this.repository.getUserTimeZone(userId)) ?? "UTC")
      : undefined;
    return this.repository.list(userId, query, timeZone ? dayBounds(timeZone) : undefined);
  }

  async update(userId: string, id: string, input: UpdateApplicationInput) {
    const existing = await this.repository.getSalaryState(userId, id);
    if (!existing) throw new ApiError(404, "NOT_FOUND", "Application was not found.");
    const salaryMin = input.salaryMin === undefined ? existing.salaryMin : input.salaryMin;
    const salaryMax = input.salaryMax === undefined ? existing.salaryMax : input.salaryMax;
    const currency = input.currency === undefined ? existing.currency : input.currency;
    if ((salaryMin !== null || salaryMax !== null) && !currency) {
      throw new ApiError(400, "VALIDATION_ERROR", "Currency is required with salary.");
    }
    if (salaryMin !== null && salaryMax !== null && Number(salaryMax) < Number(salaryMin)) {
      throw new ApiError(400, "VALIDATION_ERROR", "Salary maximum cannot be below salary minimum.");
    }
    const result = await this.repository.update(userId, id, input);
    if (result.kind === "not-found")
      throw new ApiError(404, "NOT_FOUND", "Application was not found.");
    if (result.kind === "invalid-tags")
      throw new ApiError(400, "BAD_REQUEST", "One or more tags are invalid.");
    return result.application;
  }

  async changeStatus(userId: string, id: string, input: ChangeApplicationStatusInput) {
    const result = await this.repository.changeStatus(userId, id, input);
    if (result.kind === "not-found")
      throw new ApiError(404, "NOT_FOUND", "Application was not found.");
    if (result.kind === "already-current")
      throw new ApiError(409, "CONFLICT", "Application already has this status.");
    if (result.kind === "conflict")
      throw new ApiError(409, "CONFLICT", "Application status changed; retry the request.");
    return { id: result.id, status: result.status };
  }

  async getHistory(userId: string, id: string) {
    const history = await this.repository.getHistory(userId, id);
    if (!history) throw new ApiError(404, "NOT_FOUND", "Application was not found.");
    return history;
  }

  async archive(userId: string, id: string): Promise<void> {
    if (!(await this.repository.archive(userId, id, new Date())))
      throw new ApiError(404, "NOT_FOUND", "Application was not found.");
  }

  async unarchive(userId: string, id: string): Promise<void> {
    if (!(await this.repository.archive(userId, id, null)))
      throw new ApiError(404, "NOT_FOUND", "Application was not found.");
  }

  async delete(userId: string, id: string): Promise<void> {
    if (!(await this.repository.delete(userId, id)))
      throw new ApiError(404, "NOT_FOUND", "Application was not found.");
  }
}
