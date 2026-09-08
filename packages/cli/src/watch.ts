import { watch as fsWatch } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

import { engineFor, sidecarPathFor } from "./render";


const EXTENSIONS = new Set([".dot", ".gv", ".d2", ".md", ".markdown"]);


const SKIP = new Set(["node_modules", ".git", "target", "dist", "build", ".next"]);


export async function expand(paths: readonly string[]): Promise<string[]> {
  const out = new Set<string>();

  for (const path of paths) {
    const info = await stat(path).catch(() => null);
    if (!info) continue;

    if (info.isFile()) {


      out.add(path);
      continue;
    }
    if (info.isDirectory()) for (const found of await walk(path)) out.add(found);
  }

  return [...out].sort();
}

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];

  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (entry.name.startsWith(".") || SKIP.has(entry.name)) continue;

    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walk(path)));
      continue;
    }


    if (path.endsWith(".zlayout.toml")) continue;

    const dot = entry.name.lastIndexOf(".");
    if (dot >= 0 && EXTENSIONS.has(entry.name.slice(dot).toLowerCase())) out.push(path);
  }

  return out;
}


export async function watch(
  paths: readonly string[],
  onChange: (path: string) => Promise<void>,
  debounceMs = 80,
): Promise<void> {
  const files = await expand(paths);
  const roots = await watchRoots(paths);


  const owners = new Map<string, string>();
  for (const file of files) owners.set(resolve(sidecarPathFor(file)), file);

  const pending = new Map<string, NodeJS.Timeout>();
  let running: Promise<void> = Promise.resolve();

  const queue = (path: string) => {
    clearTimeout(pending.get(path));
    pending.set(
      path,
      setTimeout(() => {
        pending.delete(path);


        running = running.then(() => onChange(path)).catch((e: Error) => {
          console.error(e.stack ?? e.message);
        });
      }, debounceMs),
    );
  };

  const watchers = roots.map((root) =>
    fsWatch(root, { recursive: true }, (_event, name) => {
      if (!name) return;

      const full = resolve(root, name.toString());
      const owner = owners.get(full);

      if (owner) return queue(owner);
      if (full.endsWith(".zlayout.toml")) return;
      if (engineFor(full) || /\.(md|markdown)$/i.test(full)) queue(full);
    }),
  );


  await new Promise<void>((resolveWatch) => {
    const stop = () => {
      for (const watcher of watchers) watcher.close();
      for (const timer of pending.values()) clearTimeout(timer);
      resolveWatch();
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  });
}


async function watchRoots(paths: readonly string[]): Promise<string[]> {
  const roots = new Set<string>();

  for (const path of paths) {
    const info = await stat(path).catch(() => null);
    if (!info) continue;
    roots.add(resolve(info.isDirectory() ? path : join(path, "..")));
  }

  return [...roots];
}
