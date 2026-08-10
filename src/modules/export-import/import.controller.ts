import type { Request, Response } from "express";

import { ApiError } from "../../lib/api-error.js";
import { sendSuccess } from "../../lib/api-response.js";
import type { ImportService } from "./import.service.js";
import { importBackupSchema } from "./import.validators.js";

export class ImportController {
  constructor(private readonly service: ImportService) {}

  async json(request: Request, response: Response): Promise<void> {
    if (!request.auth) throw new ApiError(401, "UNAUTHORIZED", "Authentication is required.");
    await this.service.importJson(request.auth.userId, importBackupSchema.parse(request.body));
    sendSuccess(response, { message: "Import completed" });
  }
}
