import type { Annotation } from "./Annotation";
import type { EdgeHint } from "./EdgeHint";
import type { Layout } from "./Layout";
import type { Pin } from "./Pin";
import type { SequenceHints } from "./SequenceHints";
import type { StyleHint } from "./StyleHint";
import type { ThemeRef } from "./ThemeRef";

export type Sidecar = { version: number, blocks?: { [key in string]: Layout }, engine?: string | null, theme?: ThemeRef | null, pins?: { [key in string]: Pin }, edges?: { [key in string]: EdgeHint }, styles?: { [key in string]: StyleHint }, sequence?: SequenceHints | null, annotations?: { [key in string]: Annotation }, };
