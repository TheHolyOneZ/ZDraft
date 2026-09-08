import type { NodeShape, SourceRange } from "../model/scene";


export interface SourceEdit {

  source: string;


  changed: SourceRange[];

  label: string;
}


export interface LayoutKnob {

  id: string;
  label: string;

  note: string;
  kind: "choice" | "number";
  choices?: ReadonlyArray<{ value: string; label: string }>;
  min?: number;
  max?: number;
  step?: number;

  fallback: string;
}


export interface LayoutTuner {
  knobs: readonly LayoutKnob[];

  read(source: string): Record<string, string>;

  set(source: string, knob: string, value: string): SourceEdit | null;
}


export interface SemanticEditor {


  rename(source: string, id: string, next: string): SourceEdit | null;


  setLabel(source: string, id: string, next: string): SourceEdit | null;


  setShape(source: string, id: string, next: NodeShape): SourceEdit | null;


  group?(source: string, ids: readonly string[], title: string): SourceEdit | null;


  shapes: readonly NodeShape[];


  tuning?: LayoutTuner;


  idProblem(name: string): string | null;
}


export function splice(
  source: string,
  range: SourceRange,
  text: string,
): { source: string; changed: SourceRange } {
  return {
    source: source.slice(0, range.from) + text + source.slice(range.to),
    changed: { from: range.from, to: range.from + text.length },
  };
}


export function spliceAll(
  source: string,
  edits: ReadonlyArray<{ range: SourceRange; text: string }>,
): { source: string; changed: SourceRange[] } {
  const ordered = [...edits].sort((a, b) => a.range.from - b.range.from);

  let out = source;
  let shift = 0;
  const changed: SourceRange[] = [];

  for (const edit of ordered) {
    const from = edit.range.from + shift;
    const to = edit.range.to + shift;
    out = out.slice(0, from) + edit.text + out.slice(to);

    changed.push({ from, to: from + edit.text.length });
    shift += edit.text.length - (edit.range.to - edit.range.from);
  }

  return { source: out, changed };
}
