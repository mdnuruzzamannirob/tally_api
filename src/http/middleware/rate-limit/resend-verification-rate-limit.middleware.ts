import { createRateLimit } from "./rate-limit.factory.js";

export const resendVerificationRateLimit = createRateLimit(60 * 60 * 1_000, 5);
