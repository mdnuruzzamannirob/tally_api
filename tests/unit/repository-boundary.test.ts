import { describe, expect, it } from "vitest";

import {
  auditRepositoryBoundary,
  findBoundaryViolations,
} from "../../scripts/audit-repository-boundary.js";

describe("repository boundary audit", () => {
  it("passes the current application source tree", () => {
    expect(auditRepositoryBoundary()).toEqual([]);
  });

  it("rejects a forbidden Prisma service import", () => {
    const violations = findBoundaryViolations(
      "src/modules/example/example.service.ts",
      'import type { PrismaClient } from "../../generated/prisma/client.js";\n',
    );
    expect(violations.length).toBeGreaterThan(0);
  });
});
