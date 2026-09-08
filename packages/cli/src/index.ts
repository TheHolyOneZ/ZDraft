import { mkdir, writeFile } from "node:fs/promises";
import { basename, join, relative } from "node:path";

import { DIAGRAM_THEMES } from "../../../src/core/theme";
import { RenderError, renderFile, type RenderOptions } from "./render";
import { expand, watch } from "./watch";


const USAGE = `zdraft — render ZDraft diagrams, layout pins and all

  zdraft render <paths...> [options]
  zdraft watch  <paths...> [options]

A path may be a file or a folder; folders are walked for .dot, .gv, .d2 and .md.

Options
  -o, --out <dir>      Where the SVGs go. Default: beside each source file.
      --theme <name>   Diagram theme. A file's own theme wins over this.
      --padding <n>    Space around the diagram, in diagram units. Default 16.
      --no-background  Transparent, for dropping onto a slide.
      --no-pins        Ignore the sidecars and render pure auto-layout.
      --layout <prog>  Graphviz program: dot, neato, fdp, circo, twopi.
      --strict         Treat warnings as failures. For CI.
  -q, --quiet          Print nothing but errors.
  -h, --help           This.

Themes: ${DIAGRAM_THEMES.map((t) => t.id).join(", ")}
`;

interface Args {
  command: "render" | "watch";
  paths: string[];
  out: string | null;
  strict: boolean;
  quiet: boolean;
  options: RenderOptions;
}

class UsageError extends Error {}

export function parseArgs(argv: readonly string[]): Args {
  const [command, ...rest] = argv;
  if (command !== "render" && command !== "watch") {
    throw new UsageError(
      command ? `Unknown command “${command}”.` : "Say what to do: render, or watch.",
    );
  }

  const args: Args = {
    command,
    paths: [],
    out: null,
    strict: false,
    quiet: false,
    options: { theme: "blueprint", ignorePins: false, padding: 16, background: true },
  };

  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i]!;


    const value = () => {
      const next = rest[i + 1];
      if (next === undefined || next.startsWith("-")) {
        throw new UsageError(`${arg} needs a value.`);
      }
      i += 1;
      return next;
    };

    switch (arg) {
      case "-o":
      case "--out":
        args.out = value();
        break;
      case "--theme": {
        const name = value();
        if (!DIAGRAM_THEMES.some((t) => t.id === name)) {
          throw new UsageError(
            `No theme called “${name}”. Try: ${DIAGRAM_THEMES.map((t) => t.id).join(", ")}.`,
          );
        }
        args.options.theme = name;
        break;
      }
      case "--padding": {
        const padding = Number(value());
        if (!Number.isFinite(padding) || padding < 0) {
          throw new UsageError("--padding needs a number that is not negative.");
        }
        args.options.padding = padding;
        break;
      }
      case "--layout":
        args.options.layoutProgram = value();
        break;
      case "--no-background":
        args.options.background = false;
        break;
      case "--no-pins":
        args.options.ignorePins = true;
        break;
      case "--strict":
        args.strict = true;
        break;
      case "-q":
      case "--quiet":
        args.quiet = true;
        break;
      default:
        if (arg.startsWith("-")) throw new UsageError(`Unknown option “${arg}”.`);
        args.paths.push(arg);
    }
  }

  if (args.paths.length === 0) throw new UsageError("Say which files to render.");
  return args;
}


interface Outcome {
  written: number;
  errors: number;
  warnings: number;
}

async function renderOne(path: string, args: Args, log: (line: string) => void): Promise<Outcome> {
  const outcome: Outcome = { written: 0, errors: 0, warnings: 0 };

  let results;
  try {
    results = await renderFile(path, args.options);
  } catch (e) {
    const error = e as RenderError;
    console.error(`✗ ${path}\n  ${error.message}`);
    if (error.remedy) console.error(`  ${error.remedy}`);
    return { ...outcome, errors: 1 };
  }

  for (const result of results) {
    const errors = result.diagnostics.filter((d) => d.severity === "error");
    const warnings = result.diagnostics.filter((d) => d.severity === "warning");

    outcome.errors += errors.length;
    outcome.warnings += warnings.length;

    for (const d of errors) console.error(`✗ ${result.source}${where(d)}: ${d.message}`);
    for (const d of warnings) console.error(`! ${result.source}${where(d)}: ${d.message}`);


    for (const id of result.orphans) {
      console.error(
        `! ${result.source}: the sidecar pins “${id}”, which this diagram no longer has.`,
      );
      outcome.warnings += 1;
    }

    if (errors.length > 0) continue;

    const dir = args.out ?? join(path, "..");
    await mkdir(dir, { recursive: true });

    const file = join(dir, `${result.name}.svg`);
    await writeFile(file, result.svg, "utf8");
    outcome.written += 1;

    log(
      `→ ${relative(process.cwd(), file)}` +
        (result.pinned > 0 ? `  (${result.pinned} pinned)` : ""),
    );
  }

  return outcome;
}

function where(d: { line?: number; column?: number }): string {
  if (d.line === undefined) return "";
  return d.column === undefined ? `:${d.line}` : `:${d.line}:${d.column}`;
}

export async function main(argv: readonly string[]): Promise<number> {
  if (argv.length === 0 || argv.includes("-h") || argv.includes("--help")) {
    console.log(USAGE);
    return 0;
  }

  let args: Args;
  try {
    args = parseArgs(argv);
  } catch (e) {
    console.error(`${(e as Error).message}\n`);
    console.error(USAGE);
    return 2;
  }

  const log = args.quiet ? () => {} : (line: string) => console.log(line);

  const files = await expand(args.paths);
  if (files.length === 0) {
    console.error("Nothing to render: no .dot, .gv, .d2 or .md files in what you named.");
    return 1;
  }

  const run = async (paths: readonly string[]): Promise<Outcome> => {
    const total: Outcome = { written: 0, errors: 0, warnings: 0 };

    for (const path of paths) {
      const one = await renderOne(path, args, log);
      total.written += one.written;
      total.errors += one.errors;
      total.warnings += one.warnings;
    }
    return total;
  };

  const first = await run(files);

  if (args.command === "watch") {
    log(`\nWatching ${files.length} ${files.length === 1 ? "file" : "files"}. Ctrl+C to stop.`);


    await watch(args.paths, async (changed) => {
      log(`\n${new Date().toLocaleTimeString()}  ${basename(changed)}`);
      await run([changed]);
    });
    return 0;
  }

  if (!args.quiet) {
    const parts = [`${first.written} written`];
    if (first.errors) parts.push(`${first.errors} failed`);
    if (first.warnings) parts.push(`${first.warnings} warned`);
    console.log(`\n${parts.join(", ")}.`);
  }

  if (first.errors > 0) return 1;
  return args.strict && first.warnings > 0 ? 1 : 0;
}
