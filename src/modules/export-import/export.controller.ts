import type { Request, Response } from "express";

import { ApiError } from "../../lib/api-error.js";
import type { ExportService } from "./export.service.js";

export class ExportController {
  constructor(private readonly service: ExportService) {}

  async json(request: Request, response: Response): Promise<void> {
    if (!request.auth) throw new ApiError(401, "UNAUTHORIZED", "Authentication is required.");
    const backup = await this.service.exportJson(request.auth.userId);
    response.type("application/json");
    response.attachment(`tally-backup-${new Date().toISOString().slice(0, 10)}.json`);
    response.send(backup);
  }

  async csv(request: Request, response: Response): Promise<void> {
    if (!request.auth) throw new ApiError(401, "UNAUTHORIZED", "Authentication is required.");
    const csv = await this.service.exportCsv(request.auth.userId);
    response.type("text/csv");
    response.attachment(`tally-applications-${new Date().toISOString().slice(0, 10)}.csv`);
    response.send(csv);
  }
}
