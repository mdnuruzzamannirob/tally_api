import { createRateLimit } from "./rate-limit.factory.js";

export const authRateLimit = createRateLimit(15 * 60 * 1_000, 10);
