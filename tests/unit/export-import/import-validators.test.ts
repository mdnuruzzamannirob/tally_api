import { describe, expect, it } from "vitest";

import { importBackupSchema } from "../../../src/modules/export-import/export-import.validators.js";

const timestamp = "2026-01-01T00:00:00.000Z";

function validBackup() {
  return {
    version: 1,
    exportedAt: timestamp,
    profile: {
      name: null,
      preferences: {
        theme: "SYSTEM",
        defaultLandingPage: "DASHBOARD",
        timeZone: "UTC",
        notificationsEnabled: false,
      },
    },
    tags: [{ ref: "tag-1", name: "priority", color: null }],
    applications: [
      {
        ref: "application-1",
        company: "Tally",
        role: "Engineer",
        jobUrl: null,
        location: null,
        remoteType: null,
        employmentType: null,
        source: null,
        status: "APPLIED",
        appliedAt: null,
        salaryMin: null,
        salaryMax: null,
        currency: null,
        nextFollowUpAt: null,
        archivedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        tagRefs: ["tag-1"],
        notes: [],
        interviews: [],
        statusHistory: [
          { fromStatus: "WISHLIST", toStatus: "APPLIED", note: null, changedAt: timestamp },
        ],
      },
    ],
  };
}

describe("import backup validator", () => {
  it("accepts canonical portable data and strips account-only fields", () => {
    const backup = validBackup();
    const parsed = importBackupSchema.parse({ ...backup, email: "ignored@example.test" });
    expect(parsed).not.toHaveProperty("email");
    expect(parsed.applications[0]?.status).toBe("APPLIED");
  });

  it("rejects dangling references and inconsistent status histories", () => {
    const dangling = validBackup();
    const danglingApplication = dangling.applications[0];
    if (!danglingApplication) throw new Error("Expected application fixture.");
    danglingApplication.tagRefs = ["unknown-tag"];
    expect(() => importBackupSchema.parse(dangling)).toThrow();

    const inconsistent = validBackup();
    const inconsistentApplication = inconsistent.applications[0];
    if (!inconsistentApplication) throw new Error("Expected application fixture.");
    inconsistentApplication.statusHistory = [];
    expect(() => importBackupSchema.parse(inconsistent)).toThrow();
  });

  it.each(["2026-02-31", "2026-02-29", "2024-02-30", "2026-13-01", "2026-01-00"])(
    "rejects impossible calendar date %s",
    (appliedAt) => {
      const backup = validBackup();
      expect(
        importBackupSchema.safeParse({
          ...backup,
          applications: backup.applications.map((application) => ({ ...application, appliedAt })),
        }).success,
      ).toBe(false);
    },
  );

  it.each(["2024-02-29", "2026-02-28", null])("preserves valid calendar date %s", (appliedAt) => {
    const backup = validBackup();
    const parsed = importBackupSchema.parse({
      ...backup,
      applications: backup.applications.map((application) => ({ ...application, appliedAt })),
    });
    expect(parsed.applications[0]?.appliedAt).toEqual(
      appliedAt ? new Date(`${appliedAt}T00:00:00.000Z`) : null,
    );
  });
});
