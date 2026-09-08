import { readFileSync } from "node:fs";

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";


// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;


const version = JSON.parse(readFileSync("package.json", "utf8")).version as string;

export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],
  define: { __APP_VERSION__: JSON.stringify(version) },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/src-tauri/**", "**/crates/**", "**/target/**"] },
  },


  assetsInclude: ["**/*.wasm"],
  test: {
    environment: "jsdom",


    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "packages/*/src/**/*.test.ts"],
  },
}));
