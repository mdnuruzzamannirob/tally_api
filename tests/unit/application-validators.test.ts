import { describe, expect, it } from "vitest";

import {
  changeApplicationStatusSchema,
  createApplicationSchema,
  listApplicationsQuerySchema,
  updateApplicationSchema,
} from "../../src/modules/applications/application.validators.js";
import { interviewListQuerySchema } from "../../src/modules/interviews/interview.validators.js";

describe("resource validators", () => {
  it("enforces application salary, date, and update-status rules", () => {
    expect(() =>
      createApplicationSchema.parse({
        company: "Tally",
        role: "Engineer",
        salaryMin: 20,
        salaryMax: 10,
        currency: "USD",
      }),
    ).toThrow();
    expect(() =>
      createApplicationSchema.parse({
        company: "Tally",
        role: "Engineer",
        appliedAt: "2026-02-31",
      }),
    ).toThrow();
    expect(() => updateApplicationSchema.parse({ status: "OFFER" })).toThrow();
    expect(
      changeApplicationStatusSchema.parse({ toStatus: "OFFER", note: "  Great news.  " }),
    ).toEqual({
      toStatus: "OFFER",
      note: "Great news.",
    });
  });

  it("accepts strict list query values and rejects unsafe query variants", () => {
    expect(
      listApplicationsQuerySchema.parse({ page: "2", pageSize: "50", includeArchived: "true" }),
    ).toMatchObject({
      page: 2,
      pageSize: 50,
      includeArchived: true,
    });
    expect(() => listApplicationsQuerySchema.parse({ includeArchived: "1" })).toThrow();
    expect(() => interviewListQuerySchema.parse({ range: "future" })).toThrow();
  });
});
