import type { ExportRepository } from "../export-import.repository.js";
import { escapeCsv, neutralizeCsvFormula } from "./csv-sanitizer.js";

const csvColumns = [
  "company",
  "role",
  "status",
  "jobUrl",
  "location",
  "remoteType",
  "employmentType",
  "source",
  "appliedAt",
  "nextFollowUpAt",
  "salaryMin",
  "salaryMax",
  "currency",
  "tags",
  "createdAt",
  "updatedAt",
] as const;

type CsvApplications = Awaited<ReturnType<ExportRepository["listCsvApplications"]>>;

export function buildApplicationsCsv(applications: CsvApplications): string {
  const rows = applications.map((application) =>
    [
      application.company,
      application.role,
      application.status,
      application.jobUrl,
      application.location,
      application.remoteType,
      application.employmentType,
      application.source,
      application.appliedAt?.toISOString().slice(0, 10) ?? null,
      application.nextFollowUpAt?.toISOString() ?? null,
      application.salaryMin?.toString() ?? null,
      application.salaryMax?.toString() ?? null,
      application.currency,
      JSON.stringify(application.tags.map(({ tag }) => neutralizeCsvFormula(tag.name))),
      application.createdAt.toISOString(),
      application.updatedAt.toISOString(),
    ]
      .map(escapeCsv)
      .join(","),
  );
  return [csvColumns.join(","), ...rows].join("\r\n");
}
