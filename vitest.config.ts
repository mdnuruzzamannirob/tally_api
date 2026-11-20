import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    clearMocks: true,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.d.ts", "src/**/*.types.ts", "src/generated/**"],
      reporter: ["text", "text-summary", "json-summary", "html"],
      reportsDirectory: "./coverage",
    },
  },
});
