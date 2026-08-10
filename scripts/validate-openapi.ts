import { fileURLToPath } from "node:url";

import SwaggerParser from "@apidevtools/swagger-parser";
import { openApiRoutes } from "./openapi-routes.js";

const contractPath = fileURLToPath(new URL("../contracts/openapi.json", import.meta.url));

await SwaggerParser.validate(contractPath);
const contract = (await SwaggerParser.parse(contractPath)) as {
  paths: Record<string, Record<string, unknown>>;
};
const actual = new Set(
  Object.entries(contract.paths).flatMap(([path, methods]) =>
    Object.keys(methods).map((method) => `${method.toUpperCase()} ${path}`),
  ),
);
const expected = new Set(
  openApiRoutes.map(({ method, path }) => `${method.toUpperCase()} ${path}`),
);
const missing = [...expected].filter((route) => !actual.has(route));
const unexpected = [...actual].filter((route) => !expected.has(route));
if (missing.length || unexpected.length) {
  throw new Error(
    `OpenAPI route parity failed. Missing: ${missing.join(", ")}. Unexpected: ${unexpected.join(", ")}.`,
  );
}
console.info("OpenAPI contract is valid.");
