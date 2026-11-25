import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => ({
  base: "./",
  plugins: [
    react(),
    {
      name: "arklens-csp",
      transformIndexHtml(html) {
        if (command === "build") return html;
        return html
          .replace("script-src 'self'", "script-src 'self' 'unsafe-inline'")
          .replace(
            "connect-src 'self'",
            "connect-src 'self' ws://localhost:* ws://127.0.0.1:*",
          );
      },
    },
  ],
  test: { environment: "jsdom" },
}));
