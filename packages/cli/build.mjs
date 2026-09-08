import { build } from "esbuild";

/**
 * Bundle the CLI.
 *
 * `src/core/` imports its own folders — `from "../theme"` rather than
 * `"../theme/index.ts"` — which is how every bundler resolves and is not
 * something Node's ESM loader does. Rather than write two import styles into
 * the engine to suit one host, the CLI is bundled the way it would ship anyway.
 *
 * The WASM engines stay external: they load their own binaries at runtime and
 * inlining them would produce a 30 MB script that still had to find them.
 */
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
