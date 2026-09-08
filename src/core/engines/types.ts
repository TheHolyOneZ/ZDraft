import type { SemanticEditor } from "../edit/types";
import type { LocateIndex } from "../locate/types";
import type { Direction, EngineId, Family, LayoutResult } from "../model/scene";
import type { SequenceHints } from "../sidecar/types";
import type { DiagramTheme } from "../theme";

export interface LayoutOpts {


  theme?: DiagramTheme;


  layoutProgram?: string;

  direction?: Direction;

  nodeSep?: number;
  rankSep?: number;


  sequenceHints?: SequenceHints | null;
}


export interface EngineAdapter {
  id: EngineId;

  label: string;
  extensions: string[];


  detectFamily(source: string): Family;

  layout(source: string, opts?: LayoutOpts): Promise<LayoutResult>;

  locate(source: string): LocateIndex;


  edit?: SemanticEditor | null;


  available?(): Promise<{ ok: true } | { ok: false; reason: string; remedy: string }>;
}


export function fingerprint(kind: string, label: string, ordinal: number): string {
  return `${kind}:${label.trim().replace(/\s+/g, " ")}:${ordinal}`;
}


export function makeFingerprinter(): (kind: string, label: string) => string {
  const seen = new Map<string, number>();

  return (kind, label) => {
    const key = `${kind}:${label.trim().replace(/\s+/g, " ")}`;
    const n = seen.get(key) ?? 0;
    seen.set(key, n + 1);
    return fingerprint(kind, label, n);
  };
}
