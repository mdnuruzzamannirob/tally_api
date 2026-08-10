import { fileURLToPath } from "node:url";

import SwaggerParser from "@apidevtools/swagger-parser";

const contractPath = fileURLToPath(new URL("../contracts/openapi.json", import.meta.url));

await SwaggerParser.validate(contractPath);
console.info("OpenAPI contract is valid.");
