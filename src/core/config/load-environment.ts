import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "dotenv";

/** Select exactly one profile; injected process variables always take precedence. */
export function loadEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
  directory = process.cwd(),
): string {
  const file =
    environment.NODE_ENV === "production"
      ? ".env.production"
      : environment.NODE_ENV === "test"
        ? ".env.test"
        : ".env";
  let values: Record<string, string>;
  try {
    values = parse(readFileSync(resolve(directory, file)));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return file;
    throw new Error(`Unable to read ${file}.`);
  }
  for (const [key, value] of Object.entries(values)) environment[key] ??= value;
  return file;
}
