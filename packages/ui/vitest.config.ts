import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: [path.resolve(__dirname, "src/test/setup.ts")],
  },
  resolve: {
    alias: {
      "@repo/ui": path.resolve(__dirname, "src"),
    },
  },
});
