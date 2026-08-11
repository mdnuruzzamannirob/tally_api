import type { Request, Response } from "express";

import { sendSuccess } from "../../http/response/success-response.js";
import type { HealthService } from "./health.service.js";

export class HealthController {
  constructor(private readonly service: HealthService) {}

  async status(_request: Request, response: Response): Promise<void> {
    sendSuccess(response, await this.service.getStatus(), { message: "Service is healthy." });
  }
}
