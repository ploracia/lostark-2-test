import { readFileSync } from "node:fs";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { parseProxyOrigin } from "./src/proxy-url";

export default defineConfig(({ command, mode }) => {
  const origin = parseProxyOrigin(loadEnv(mode, ".", "VITE_").VITE_PROXY_URL);
  const index = readFileSync(new URL("./index.html", import.meta.url), "utf8");
  const policy = index.match(
    /http-equiv="Content-Security-Policy"\s+content="([^"]+)"/,
  )?.[1];
  if (!policy) throw new Error("Missing CSP in index.html");
  const connectPolicy = origin
    ? policy.replace("connect-src 'self'", "connect-src 'self' " + origin)
    : policy;

  return {
    plugins: [
      react(),
      {
        name: "mokokoloa-csp",
        transformIndexHtml(html) {
          html = html.replace(policy, connectPolicy);
          if (command === "build") return html;
          return html
            .replace("script-src 'self'", "script-src 'self' 'unsafe-inline'")
            .replace(
              "connect-src 'self'",
              "connect-src 'self' ws://localhost:* ws://127.0.0.1:*",
            );
        },
        generateBundle() {
          const headers = readFileSync(
            new URL("./_headers", import.meta.url),
            "utf8",
          );
          this.emitFile({
            type: "asset",
            fileName: "_headers",
            source:
              headers.trimEnd() +
              "\n  Content-Security-Policy: " +
              connectPolicy +
              "\n",
          });
        },
      },
    ],
    test: { environment: "jsdom" },
  };
});
