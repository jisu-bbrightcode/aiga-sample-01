import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  // Web (Vercel) nested routes must resolve assets from the app root.
  base: "/",
  plugins: [
    tsconfigPaths({
      projects: ["./tsconfig.json", "../../packages/ui/tsconfig.json"],
    }),
    tailwindcss(),
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler", { target: "19" }]],
      },
    }),
  ],
  envDir: "../../",
  server: {
    port: Number(process.env.PORT ?? 3000),
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
    proxy: {
      "/api": {
        target: process.env.VITE_API_URL || "http://localhost:3002",
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    // workspace source 직접 watch — pre-bundle 시 .ts 변경이 안 잡힘.
    esbuildOptions: {
      target: "esnext",
    },
  },
  resolve: {
    dedupe: [
      "react",
      "react-dom",
      "@tanstack/react-query",
      "jotai",
      "sonner",
    ],
    alias: {
      "~/components/ui": path.resolve(__dirname, "../../packages/ui/src/_shadcn"),
      "~": path.resolve(__dirname, "../../packages/ui/src"),
      "zod/v4/core": "zod",
    },
  },
  esbuild: {
    target: "esnext",
  },
  build: {
    target: "esnext",
    rollupOptions: {
      external: [
        "postgres",
        "@nestjs/common",
        "@nestjs/core",
        "@nestjs/swagger",
        "@nestjs/schedule",
        "@nestjs/websockets",
        "@nestjs/platform-socket.io",
        "drizzle-orm/pg-core",
        /^node:/,
      ],
    },
  },
});
