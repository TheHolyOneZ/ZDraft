import { parseDrawio } from "./drawio";
import { parseExcalidraw } from "./excalidraw";
import { emitMermaid } from "./emit";
import type { Layout } from "../sidecar/types";
import { ImportError, type ImportedModel } from "./types";


export { ImportError } from "./types";
export type { ImportedModel } from "./types";

export type ImportFormat = "drawio" | "excalidraw";

export interface Import {
  format: ImportFormat;

  source: string;

  layout: Layout;
  counts: { nodes: number; edges: number; groups: number };

  warnings: string[];
}


export function formatFor(name: string): ImportFormat | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".drawio") || lower.endsWith(".drawio.xml")) return "drawio";
  if (lower.endsWith(".excalidraw")) return "excalidraw";
  return null;
}


export const IMPORT_EXTENSIONS = ["drawio", "excalidraw", "xml"] as const;


export async function importDiagram(text: string, format: ImportFormat): Promise<Import> {
  const model: ImportedModel =
    format === "drawio" ? await parseDrawio(text) : parseExcalidraw(text);

  if (model.nodes.length === 0) {
    throw new ImportError(
      "This diagram has no shapes in it.",
      "Check you exported the page you meant, and that it is not empty.",
    );
  }

  const { source, layout } = emitMermaid(model);

  return {
    format,
    source,
    layout,
    counts: {
      nodes: model.nodes.length,
      edges: model.edges.length,
      groups: model.groups.length,
    },
    warnings: model.warnings,
  };
}
