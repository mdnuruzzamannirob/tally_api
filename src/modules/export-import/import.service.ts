import type { ImportRepository } from "./import.repository.js";
import type { ImportBackup } from "./import.validators.js";

export class ImportService {
  constructor(private readonly repository: ImportRepository) {}

  async importJson(userId: string, backup: ImportBackup): Promise<void> {
    await this.repository.replaceUserData(userId, backup);
  }
}
