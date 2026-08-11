import { createRateLimit } from "./rate-limit.factory.js";

export const passwordResetRateLimit = createRateLimit(60 * 60 * 1_000, 5);
