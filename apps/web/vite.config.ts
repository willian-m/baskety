import path from "path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Force all packages to use the same React and react-query instances
      react: path.resolve(__dirname, "../../node_modules/.pnpm/react@18.3.1/node_modules/react"),
      "react-dom": path.resolve(
        __dirname,
        "../../node_modules/.pnpm/react-dom@18.3.1_react@18.3.1/node_modules/react-dom",
      ),
      "@tanstack/react-query": path.resolve(
        __dirname,
        "../../node_modules/.pnpm/@tanstack+react-query@5.101.0_react@18.3.1/node_modules/@tanstack/react-query",
      ),
    },
    dedupe: ["react", "react-dom", "@tanstack/react-query"],
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": "http://localhost:8080",
      "/healthz": "http://localhost:8080",
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
});
