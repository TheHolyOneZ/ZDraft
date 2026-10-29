import type { DirEntryKind } from "./DirEntryKind";

export type FolderEntry = { name: string, path: string, kind: DirEntryKind, engine: string | null, has_layout: boolean, };
