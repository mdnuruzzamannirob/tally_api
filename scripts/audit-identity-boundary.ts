import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const identityRoots = ["src/modules/auth", "src/modules/users"];
const repositoryFiles = new Set([
  "src/modules/auth/auth.repository.ts",
  "src/modules/users/user.repository.ts",
  "src/modules/auth/oauth/oauth.repository.ts",
]);

const forbiddenForApplicationLayer = [
  /PrismaClient/,
  /generated\/prisma/,
  /(?:\.\.?\/)+lib\/prisma/,
  /\bthis\.prisma\b/,
  /\brepository\.client\b/,
  /PrismaClient\s*\|/,
];

const forbiddenCompatibilityPatterns = [
  /new\s+AuthService\(\s*prisma\b/,
  /new\s+(?:Google|GitHub)OAuthService\(\s*prisma\b/,
];

function collectTypeScriptFiles(directory: string): string[] {
  return readdirSync(join(projectRoot, directory), { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectTypeScriptFiles(path);
    return entry.isFile() && path.endsWith(".ts") ? [path] : [];
  });
}

const violations: string[] = [];

for (const relativePath of identityRoots.flatMap(collectTypeScriptFiles)) {
  const source = readFileSync(join(projectRoot, relativePath), "utf8");
  if (repositoryFiles.has(relativePath)) continue;

  for (const pattern of forbiddenForApplicationLayer) {
    if (pattern.test(source)) {
      violations.push(`${relativePath}: application layer contains ${pattern}`);
    }
  }
}

for (const relativePath of ["src", "tests"].flatMap(collectTypeScriptFiles)) {
  const source = readFileSync(join(projectRoot, relativePath), "utf8");
  for (const pattern of forbiddenCompatibilityPatterns) {
    if (pattern.test(source)) {
      violations.push(`${relativePath}: legacy constructor usage matches ${pattern}`);
    }
  }
}

if (violations.length > 0) {
  console.error("Identity boundary audit failed:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exitCode = 1;
} else {
  console.info("Identity boundary audit passed.");
  console.info(
    `Checked ${identityRoots.flatMap(collectTypeScriptFiles).length} identity source files.`,
  );
}
