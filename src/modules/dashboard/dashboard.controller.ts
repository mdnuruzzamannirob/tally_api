import type { Request, Response } from "express";

import { ApiError } from "../../lib/api-error.js";
import { sendSuccess } from "../../lib/api-response.js";
import type { DashboardService } from "./dashboard.service.js";

export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  async summary(request: Request, response: Response): Promise<void> {
    if (!request.auth) throw new ApiError(401, "UNAUTHORIZED", "Authentication is required.");
    const data = await this.service.getSummary(request.auth.userId);
    sendSuccess(response, data);
  }
}
