import { runReleaseSmoke } from "../src/release/smoke.js";

const apiBaseUrl = process.env.API_BASE_URL;

if (!apiBaseUrl) {
  throw new Error("API_BASE_URL is required for the release smoke test.");
}

await runReleaseSmoke({ apiBaseUrl, webAppUrl: process.env.WEB_APP_URL });
console.info("Release smoke test passed.");
