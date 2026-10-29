import mermaid from "mermaid";

import { MERMAID_CONFIG, MERMAID_VERSION } from "../src/core/engines/mermaidConfig";

const sources = import.meta.glob("../tests/fixtures/mermaid/*.mmd", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

declare global {
  interface Window {
    __CAPTURE__?: { version: string; svgs: Record<string, string>; errors: Record<string, string> };
  }
}

async function run() {
  mermaid.initialize(MERMAID_CONFIG as Parameters<typeof mermaid.initialize>[0]);

  const svgs: Record<string, string> = {};
  const errors: Record<string, string> = {};
  const log = document.getElementById("log")!;

  for (const [path, source] of Object.entries(sources)) {
    const name = path.split("/").pop()!.replace(/\.mmd$/, "");
    try {
      const { svg } = await mermaid.render(`capture-${name}`, source);
      svgs[name] = svg;
      log.insertAdjacentHTML("beforeend", `<div>✓ ${name} (${svg.length} bytes)</div>`);
    } catch (e) {
      errors[name] = e instanceof Error ? e.message : String(e);
      log.insertAdjacentHTML("beforeend", `<div style="color:#f87171">✗ ${name}: ${errors[name]}</div>`);
    }
  }

  window.__CAPTURE__ = { version: MERMAID_VERSION, svgs, errors };
  log.insertAdjacentHTML("beforeend", `<div id="done">done</div>`);
}

void run();
