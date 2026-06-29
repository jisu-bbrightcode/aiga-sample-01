import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: [
      "src/**/*.test.{ts,tsx}",
      "src/**/__tests__/**/*.test.{ts,tsx}",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "~/components/ui": path.resolve(__dirname, "../../packages/ui/src/_shadcn"),
      "~": path.resolve(__dirname, "../../packages/ui/src"),
      "zod/v4/core": "zod",
    },
  },
});
