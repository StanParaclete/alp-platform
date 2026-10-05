import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { securityHeaders } from "./src/headers.mjs";
export default defineConfig(({ command, mode }) => ({
  plugins: [
    react(),
    ...(command === "build"
      ? [
          {
            name: "alp-security-headers",
            generateBundle() {
              const env = loadEnv(mode, process.cwd(), "VITE_");
              this.emitFile({
                type: "asset",
                fileName: "_headers",
                source: securityHeaders(
                  process.env.VITE_API_URL || env.VITE_API_URL,
                ),
              });
            },
          },
        ]
      : []),
  ],
  server: { fs: { allow: [fileURLToPath(new URL("../..", import.meta.url))] } },
  build: { sourcemap: false },
}));
