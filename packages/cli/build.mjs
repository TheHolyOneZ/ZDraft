import { build } from "esbuild";

await build({
  entryPoints: ["src/main.ts"],
  outfile: "dist/zdraft.js",
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  external: ["@hpcc-js/wasm-graphviz", "@terrastruct/d2", "mermaid", "jsdom", "smol-toml"],
  banner: { js: "#!/usr/bin/env node" },
  logLevel: "info",
});
