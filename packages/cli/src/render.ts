import { readFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

import { d2Adapter } from "../../../src/core/engines/d2";
import { graphvizAdapter } from "../../../src/core/engines/graphviz";
import type { EngineAdapter } from "../../../src/core/engines/types";
import { isMarkdown, parseMarkdownBlocks } from "../../../src/core/markdown";
import { isGraph, type Diagnostic, type EngineId, type Scene } from "../../../src/core/model/scene";
import { applyPins } from "../../../src/core/pins";
import { sceneToSvg } from "../../../src/core/render/svg";
import { parseSidecar } from "../../../src/core/sidecar/read";
import type { Layout, Sidecar } from "../../../src/core/sidecar/types";
import { themeByName } from "../../../src/core/theme";


export interface RenderOptions {
  theme: string;

  ignorePins: boolean;
  padding: number;
  background: boolean;

  layoutProgram?: string;
}

export interface Rendered {

  source: string;

  name: string;
  svg: string;
  diagnostics: Diagnostic[];

  orphans: string[];
  pinned: number;
}

const ADAPTERS: Partial<Record<EngineId, EngineAdapter>> = {
  graphviz: graphvizAdapter,
  d2: d2Adapter,
};

const BY_EXTENSION: Record<string, EngineId> = {
  ".dot": "graphviz",
  ".gv": "graphviz",
  ".d2": "d2",
  ".mmd": "mermaid",
  ".mermaid": "mermaid",
  ".puml": "plantuml",
  ".plantuml": "plantuml",
  ".iuml": "plantuml",
};

export class RenderError extends Error {
  constructor(
    message: string,
    readonly remedy: string,
  ) {
    super(message);
    this.name = "RenderError";
  }
}

export function engineFor(path: string): EngineId | null {
  const dot = path.lastIndexOf(".");
  return dot < 0 ? null : (BY_EXTENSION[path.slice(dot).toLowerCase()] ?? null);
}


export function sidecarPathFor(path: string): string {
  return join(dirname(path), `${basename(path)}.zlayout.toml`);
}


export async function renderFile(path: string, options: RenderOptions): Promise<Rendered[]> {
  const text = await readFile(path, "utf8");
  const sidecar = options.ignorePins ? null : await readSidecar(path);
  const stem = basename(path).replace(/\.[^.]+$/, "");

  if (isMarkdown(path)) {
    const blocks = parseMarkdownBlocks(text);
    if (blocks.length === 0) {
      throw new RenderError(
        `${path} has no diagrams in it.`,
        "Fence them as ```mermaid, ```dot or ```d2 — ZDraft reads the same fences GitHub does.",
      );
    }

    const out: Rendered[] = [];
    for (const block of blocks) {
      out.push(
        await renderOne(
          block.source,
          block.engine,
          sidecar?.blocks?.[block.id] ?? null,
          `${path}#${block.id}`,
          `${stem}-${block.id}`,
          options,
        ),
      );
    }
    return out;
  }

  const engine = engineFor(path);
  if (!engine) {
    throw new RenderError(
      `ZDraft does not know what ${basename(path)} is.`,
      `Name it .dot, .d2, .mmd, .puml or .md — the extension is what picks the engine.`,
    );
  }

  return [await renderOne(text, engine, layoutOf(sidecar), path, stem, options)];
}

async function renderOne(
  source: string,
  engine: EngineId,
  layout: Layout | null,
  from: string,
  name: string,
  options: RenderOptions,
): Promise<Rendered> {
  const adapter = ADAPTERS[engine];
  if (!adapter) {


    throw new RenderError(
      `The CLI cannot render ${engine} yet.`,
      engine === "mermaid"
        ? "Mermaid needs a browser to measure its text, and gets it wrong without one. Export from ZDraft, or write the diagram in Graphviz or D2 — both render here exactly as they do in the app."
        : "PlantUML needs a JVM the CLI does not drive yet. Export it from ZDraft instead.",
    );
  }

  const theme = themeByName(layout?.theme?.name ?? options.theme);
  const result = await adapter.layout(source, {
    theme,
    layoutProgram: options.layoutProgram,
    sequenceHints: layout?.sequence ?? undefined,
  });

  const applied = apply(result.scene, layout);

  return {
    source: from,
    name,
    svg: sceneToSvg(applied.scene, theme, {
      padding: options.padding,
      background: options.background,
      title: name,
      annotations: layout?.annotations,
    }),
    diagnostics: [...result.diagnostics, ...applied.diagnostics],
    orphans: applied.orphans,
    pinned: applied.pinned,
  };
}

function apply(
  scene: Scene,
  layout: Layout | null,
): { scene: Scene; diagnostics: Diagnostic[]; orphans: string[]; pinned: number } {
  if (!layout || !isGraph(scene)) {
    return { scene, diagnostics: [], orphans: [], pinned: 0 };
  }

  const applied = applyPins(scene, layout);
  return {
    scene: applied.scene,
    diagnostics: applied.diagnostics,
    orphans: applied.orphans.map((o) => o.id),
    pinned: Object.keys(layout.pins ?? {}).length - applied.orphans.length,
  };
}


async function readSidecar(path: string): Promise<Sidecar | null> {
  let text: string;
  try {
    text = await readFile(sidecarPathFor(path), "utf8");
  } catch {
    return null;
  }
  return parseSidecar(text);
}

function layoutOf(sidecar: Sidecar | null): Layout | null {
  if (!sidecar) return null;
  const { version: _version, blocks: _blocks, ...layout } = sidecar;
  return layout;
}
