import type { Annotation } from "./Annotation";
import type { EdgeHint } from "./EdgeHint";
import type { Pin } from "./Pin";
import type { SequenceHints } from "./SequenceHints";
import type { ThemeRef } from "./ThemeRef";

export type Layout = { engine?: string | null, theme?: ThemeRef | null, pins?: { [key in string]: Pin }, edges?: { [key in string]: EdgeHint }, sequence?: SequenceHints | null, annotations?: { [key in string]: Annotation }, };
