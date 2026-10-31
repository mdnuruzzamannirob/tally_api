import { loadEnvironment } from "./load-environment.js";

import { parseEnvironment } from "./env.schema.js";

export { parseEnvironment, type Environment } from "./env.schema.js";

loadEnvironment();

/** Validated runtime configuration. Import this from application code. */
export const env = parseEnvironment(process.env);
