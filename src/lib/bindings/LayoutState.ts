import type { Conflict } from "./Conflict";
import type { Sidecar } from "./Sidecar";

export type LayoutState = { "status": "none" } | { "status": "ok", sidecar: Sidecar, } | { "status": "conflict", conflict: Conflict, } | { "status": "invalid", message: string, };
