import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    tailwindcss(),
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler", { target: "19" }]],
      },
    }),
  ],
  envDir: "../",
  server: {
    port: 3001,
  },
  resolve: {
    dedupe: [
      "react",
      "react-dom",
      "@tanstack/react-query",
      "jotai",
      "sonner",
    ],
  },
});
