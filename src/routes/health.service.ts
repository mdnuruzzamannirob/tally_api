import { ApiError } from "../lib/api-error.js";

export class HealthService {
  constructor(private readonly checkDatabase: () => Promise<void>) {}

  async getStatus() {
    try {
      await this.checkDatabase();
    } catch {
      throw new ApiError(503, "SERVICE_UNAVAILABLE", "Service temporarily unavailable.");
    }
    return {
      status: "ok" as const,
      database: "connected" as const,
      timestamp: new Date().toISOString(),
    };
  }
}
