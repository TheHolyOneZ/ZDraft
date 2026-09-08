import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

import type { Conflict } from "./bindings/Conflict";
import type { FolderEntry } from "./bindings/FolderEntry";
import type { GitStatus } from "./bindings/GitStatus";
import type { Layout } from "./bindings/Layout";
import type { Pin } from "./bindings/Pin";
import type { PlantUmlProbe } from "./bindings/PlantUmlProbe";
import type { Sidecar } from "./bindings/Sidecar";

export type { Conflict, FolderEntry, GitStatus, Layout, Pin, PlantUmlProbe, Sidecar };


export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}


export function appWindow(): ReturnType<typeof getCurrentWindow> | null {
  if (!isTauri()) return null;
  try {
    return getCurrentWindow();
  } catch {
    return null;
  }
}


export interface CommandError {
  code: string;
  message: string;
  remedy: string;
  retryable: boolean;
}

export function isCommandError(value: unknown): value is CommandError {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    "message" in value &&
    "remedy" in value
  );
}


export function describeError(err: unknown): { message: string; remedy: string } {
  if (isCommandError(err)) return { message: err.message, remedy: err.remedy };
  if (err instanceof Error) return { message: err.message, remedy: "" };
  return { message: String(err), remedy: "" };
}

export interface OpenedFile {
  path: string;
  name: string;
  text: string;
  engine: string | null;
  layoutText: string | null;
}

export type LayoutState =
  | { status: "none" }
  | { status: "ok"; sidecar: Sidecar }
  | { status: "conflict"; conflict: Conflict }
  | { status: "invalid"; message: string };

async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri()) {
    throw {
      code: "host.no_tauri",
      message: `\`${command}\` needs the desktop app.`,
      remedy: "Run ZDraft with `pnpm tauri dev` rather than `pnpm dev`.",
      retryable: false,
    } satisfies CommandError;
  }
  return invoke<T>(command, args);
}

export const api = Object.freeze({
  listFolder: (path: string) => call<FolderEntry[]>("list_folder", { path }),

  readFile: async (path: string): Promise<OpenedFile> => {
    const raw = await call<{
      path: string;
      name: string;
      text: string;
      engine: string | null;
      layout_text: string | null;
    }>("read_file", { path });
    return { ...raw, layoutText: raw.layout_text };
  },

  writeFile: (path: string, text: string) => call<void>("write_file", { path, text }),

  writeBytes: (path: string, bytes: number[]) => call<void>("write_bytes", { path, bytes }),


  writePdf: (path: string, svg: string) => call<void>("write_pdf", { path, svg }),


  outlineSvg: (svg: string) => call<string>("outline_svg", { svg }),

  pathExists: (path: string) => call<boolean>("path_exists", { path }),

  readLayout: (diagram: string) => call<LayoutState>("read_layout", { diagram }),

  writeLayout: (diagram: string, sidecar: Sidecar) =>
    call<void>("write_layout", { diagram, sidecar }),

  resolveLayoutConflict: (diagram: string, text: string) =>
    call<void>("resolve_layout_conflict", { diagram, text }),

  parseLayout: (text: string) => call<Sidecar>("parse_layout", { text }),

  gitHeadBlob: (path: string) => call<string | null>("git_head_blob", { path }),

  gitStatus: (path: string) => call<GitStatus>("git_status", { path }),

  deleteLayout: (diagram: string) => call<void>("delete_layout", { diagram }),

  layoutPathFor: (diagram: string) => call<string>("layout_path_for", { diagram }),

  startupArgs: () => call<{ folder: string | null; file: string | null }>("startup_args"),

  plantumlInstall: () => call<string>("plantuml_install"),

  plantumlInstallDir: () => call<string | null>("plantuml_install_dir"),

  plantumlProbe: (jar: string | null) => call<PlantUmlProbe>("plantuml_probe", { jar }),

  plantumlRender: (source: string, jar: string | null, skinparams: string[]) =>
    call<string>("plantuml_render", { source, jar, skinparams }),
});

export type Api = typeof api;
