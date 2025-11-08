import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules",
        "dist",
        "**/*.test.ts",
        "**/*.spec.ts",
        "**/.eslintrc.*",
        "**/vitest.config.*",
        "**/tsconfig.json",
      ],
      thresholds: {
        lines: 98,
        functions: 100,
        branches: 95,
        statements: 98,
      },
    },
    globals: true,
    environment: "node",
  },
});

