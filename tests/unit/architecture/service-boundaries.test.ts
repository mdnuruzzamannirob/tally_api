import { describe, expect, it } from "vitest";

import type { ApplicationRepository } from "../../../src/modules/applications/applications.repository.js";
import { ApplicationService } from "../../../src/modules/applications/applications.service.js";
import type { InterviewRepository } from "../../../src/modules/interviews/interviews.repository.js";
import { InterviewService } from "../../../src/modules/interviews/interviews.service.js";
import type { NoteRepository } from "../../../src/modules/notes/notes.repository.js";
import { NoteService } from "../../../src/modules/notes/notes.service.js";

describe("service repository ports", () => {
  it("maps note repository ownership outcomes without a database", async () => {
    const repository = {
      list: async () => ({ kind: "application-not-found" as const }),
    } as unknown as NoteRepository;
    await expect(new NoteService(repository).list("user-1", "application-1")).rejects.toMatchObject(
      { statusCode: 404, code: "NOT_FOUND" },
    );
  });

  it("maps interview repository ownership outcomes without a database", async () => {
    const repository = {
      list: async () => ({ kind: "application-not-found" as const }),
    } as unknown as InterviewRepository;
    await expect(
      new InterviewService(repository).list(
        "user-1",
        { range: "upcoming", page: 1, pageSize: 20, includeArchived: false },
        "application-1",
      ),
    ).rejects.toMatchObject({ statusCode: 404, code: "NOT_FOUND" });
  });

  it("maps application invalid-tag outcomes without a database", async () => {
    const repository = {
      create: async () => ({ kind: "invalid-tags" as const }),
    } as unknown as ApplicationRepository;
    await expect(
      new ApplicationService(repository).create("user-1", { company: "Tally", role: "Engineer" }),
    ).rejects.toMatchObject({ statusCode: 400, code: "BAD_REQUEST" });
  });
});
