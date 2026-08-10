import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const applicationLayerPattern = /\.(service|controller|routes)\.ts$/;
const forbiddenPatterns = [
  /PrismaClient/,
  /generated\/prisma/,
  /(?:\.\.?\/)+lib\/prisma/,
  /\bthis\.prisma\b/,
  /\bPrismaClient\s*\|/,
  /\.\$transaction\b/,
];
const legacyConstructorPattern =
  /new\s+(?:Auth|GoogleOAuth|GitHubOAuth|Application|Tag|Note|Interview|Dashboard|Export|Import)Service\(\s*prisma\b/;

function collectFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectFiles(path);
    return entry.isFile() && path.endsWith(".ts") ? [path] : [];
  });
}

export function findBoundaryViolations(relativePath: string, source: string): string[] {
  const violations: string[] = [];
  if (applicationLayerPattern.test(relativePath)) {
    for (const pattern of forbiddenPatterns) {
      if (pattern.test(source))
        violations.push(`${relativePath}: forbidden boundary pattern ${pattern}`);
    }
  }
  if (legacyConstructorPattern.test(source)) {
    violations.push(`${relativePath}: legacy Prisma-backed service constructor`);
  }
  return violations;
}

export function auditRepositoryBoundary(root = projectRoot): string[] {
  const sourceRoot = join(root, "src");
  return collectFiles(sourceRoot).flatMap((absolutePath) => {
    const relativePath = relative(root, absolutePath);
    return findBoundaryViolations(relativePath, readFileSync(absolutePath, "utf8"));
  });
}

async function main(): Promise<void> {
  const violations = auditRepositoryBoundary();
  if (violations.length > 0) {
    console.error("Repository boundary audit failed:");
    for (const violation of violations) console.error(`- ${violation}`);
    process.exitCode = 1;
    return;
  }
  console.info("Repository boundary audit passed.");
}

const entryPoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === entryPoint) void main();
