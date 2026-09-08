/**
 * @vitest-environment node
 *
 * A directive, not a comment: D2's WASM wants a real worker and
 * `URL.createObjectURL`, and jsdom has neither. Do not let a tidy pass
 * take this out.
 */
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { parseArgs } from "./index";
import { engineFor, renderFile, RenderError, sidecarPathFor } from "./render";
import { expand } from "./watch";

const OPTIONS = { theme: "blueprint", ignorePins: false, padding: 16, background: true };

let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "zdraft-cli-"));

  await writeFile(
    join(dir, "chain.dot"),
    'digraph d { a [label="Alpha"]; b [label="Beta"]; a -> b; }\n',
  );
  await writeFile(
    join(dir, "chain.dot.zlayout.toml"),
    "version = 1\n\n[pins.a]\nx = 400\ny = 300\n",
  );
  await writeFile(join(dir, "broken.dot"), "digraph d { a -> ; }\n");
  await writeFile(join(dir, "notes.txt"), "not a diagram\n");
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("the arguments", () => {
  it("reads a render with its options", () => {
    const args = parseArgs(["render", "docs", "--out", "build", "--theme", "paper", "--strict"]);

    expect(args.command).toBe("render");
    expect(args.paths).toEqual(["docs"]);
    expect(args.out).toBe("build");
    expect(args.options.theme).toBe("paper");
    expect(args.strict).toBe(true);
  });

  it("reads the negative flags", () => {
    const args = parseArgs(["render", "a.dot", "--no-pins", "--no-background"]);

    expect(args.options.ignorePins).toBe(true);
    expect(args.options.background).toBe(false);
  });


  it("refuses a flag with no value rather than eating the next one", () => {
    expect(() => parseArgs(["render", "--theme", "--strict", "a.dot"])).toThrow(/needs a value/);
  });

  it("names an unknown theme and lists the real ones", () => {
    expect(() => parseArgs(["render", "a.dot", "--theme", "neon-pink"])).toThrow(/No theme/);
  });

  it("refuses an unknown option instead of ignoring it", () => {
    expect(() => parseArgs(["render", "a.dot", "--fast"])).toThrow(/Unknown option/);
  });

  it("insists on being told what to do", () => {
    expect(() => parseArgs([])).toThrow();
    expect(() => parseArgs(["render"])).toThrow(/which files/);
  });
});

describe("finding the diagrams", () => {
  it("picks the engine off the extension", () => {
    expect(engineFor("a.dot")).toBe("graphviz");
    expect(engineFor("a.D2")).toBe("d2");
    expect(engineFor("a.mmd")).toBe("mermaid");
    expect(engineFor("a.txt")).toBeNull();
  });

  it("names the sidecar the way the app does", () => {
    expect(sidecarPathFor("docs/a.dot")).toBe(join("docs", "a.dot.zlayout.toml"));
  });

  it("walks a folder for the diagrams in it", async () => {
    const found = await expand([dir]);

    expect(found.some((p) => p.endsWith("chain.dot"))).toBe(true);
    expect(found.some((p) => p.endsWith("notes.txt"))).toBe(false);

    expect(found.some((p) => p.endsWith(".zlayout.toml"))).toBe(false);
  });

  it("renders a file named outright even with an odd extension", async () => {
    const odd = join(dir, "notes.txt");
    expect(await expand([odd])).toEqual([odd]);
  });

  it("says nothing rather than throwing for a path that is not there", async () => {
    expect(await expand([join(dir, "nope")])).toEqual([]);
  });
});

describe("rendering", () => {
  it("produces an SVG", async () => {
    const [result] = await renderFile(join(dir, "chain.dot"), OPTIONS);

    expect(result!.svg.startsWith("<svg")).toBe(true);
    expect(result!.svg).toContain("Alpha");
    expect(result!.name).toBe("chain");
  });


  it("applies the pins beside the file", async () => {
    const [pinned] = await renderFile(join(dir, "chain.dot"), OPTIONS);
    const [plain] = await renderFile(join(dir, "chain.dot"), { ...OPTIONS, ignorePins: true });

    expect(pinned!.pinned).toBe(1);
    expect(plain!.pinned).toBe(0);
    expect(pinned!.svg).not.toBe(plain!.svg);
  });

  it("strips ZDraft's own chrome, which is not part of the picture", async () => {
    const [result] = await renderFile(join(dir, "chain.dot"), OPTIONS);

    expect(result!.svg).not.toContain("data-chrome");
    expect(result!.svg).not.toContain("data-waypoint");
  });

  it("reports a parse error rather than writing a broken file", async () => {
    const [result] = await renderFile(join(dir, "broken.dot"), OPTIONS);
    expect(result!.diagnostics.some((d) => d.severity === "error")).toBe(true);
  });


  it("surfaces a pin whose node no longer exists", async () => {
    const orphaned = join(dir, "orphan.dot");
    await writeFile(orphaned, "digraph d { a; }\n");
    await writeFile(sidecarPathFor(orphaned), "version = 1\n\n[pins.gone]\nx = 1\ny = 2\n");

    const [result] = await renderFile(orphaned, OPTIONS);
    expect(result!.orphans).toEqual(["gone"]);
  });

  it("renders with no sidecar at all, which is pure auto-layout", async () => {
    const bare = join(dir, "bare.dot");
    await writeFile(bare, "digraph d { a -> b; }\n");

    const [result] = await renderFile(bare, OPTIONS);
    expect(result!.pinned).toBe(0);
    expect(result!.diagnostics).toEqual([]);
  });

  it("refuses a file whose extension names no engine, with a remedy", async () => {
    const error = await renderFile(join(dir, "notes.txt"), OPTIONS).catch((e) => e);

    expect(error).toBeInstanceOf(RenderError);
    expect((error as RenderError).remedy).toContain(".dot");
  });


  it("refuses Mermaid rather than rendering it wrongly", async () => {
    const mmd = join(dir, "flow.mmd");
    await writeFile(mmd, "flowchart TD\n  a --> b\n");

    const error = await renderFile(mmd, OPTIONS).catch((e) => e);
    expect(error).toBeInstanceOf(RenderError);
    expect((error as RenderError).remedy).toMatch(/Graphviz or D2/);
  });

  it("gives each diagram in a markdown document its own name", async () => {
    const md = join(dir, "doc.md");
    await writeFile(
      md,
      "# Notes\n\n<!-- zdraft: first -->\n```dot\ndigraph d { a -> b; }\n```\n\n" +
        "<!-- zdraft: second -->\n```dot\ndigraph d { c -> d; }\n```\n",
    );

    const results = await renderFile(md, OPTIONS);
    expect(results.map((r) => r.name)).toEqual(["doc-first", "doc-second"]);
  });

  it("applies a markdown block's own pins from the shared sidecar", async () => {
    const md = join(dir, "pinned.md");
    await writeFile(md, "<!-- zdraft: only -->\n```dot\ndigraph d { a -> b; }\n```\n");
    await writeFile(
      sidecarPathFor(md),
      "version = 1\n\n[blocks.only.pins.a]\nx = 500\ny = 400\n",
    );

    const [result] = await renderFile(md, OPTIONS);
    expect(result!.pinned).toBe(1);
  });

  it("lets a file's own theme win over the one asked for", async () => {
    const themed = join(dir, "themed.dot");
    await writeFile(themed, "digraph d { a; }\n");
    await writeFile(sidecarPathFor(themed), 'version = 1\n\n[theme]\nname = "paper"\n');

    const [asked] = await renderFile(themed, { ...OPTIONS, theme: "blueprint" });
    const [ignored] = await renderFile(themed, { ...OPTIONS, ignorePins: true });


    expect(asked!.svg).not.toBe(ignored!.svg);
  });

  it("writes what it was given, byte for byte, on a second run", async () => {
    const [once] = await renderFile(join(dir, "chain.dot"), OPTIONS);
    const [twice] = await renderFile(join(dir, "chain.dot"), OPTIONS);


    expect(once!.svg).toBe(twice!.svg);
  });
});

describe("what the app would draw", () => {


  it("renders the same bytes the app's exporter does", async () => {
    const { graphvizAdapter } = await import("../../../src/core/engines/graphviz");
    const { sceneToSvg } = await import("../../../src/core/render/svg");
    const { applyPins } = await import("../../../src/core/pins");
    const { themeByName } = await import("../../../src/core/theme");
    const { isGraph } = await import("../../../src/core/model/scene");

    const source = await readFile(join(dir, "chain.dot"), "utf8");
    const theme = themeByName("blueprint");

    const laid = await graphvizAdapter.layout(source, { theme });
    if (!isGraph(laid.scene)) throw new Error("expected a graph scene");

    const scene = applyPins(laid.scene, { pins: { a: { x: 400, y: 300 } } }).scene;
    const expected = sceneToSvg(scene, theme, {
      padding: 16,
      background: true,
      title: "chain",
      annotations: undefined,
    });

    const [result] = await renderFile(join(dir, "chain.dot"), OPTIONS);
    expect(result!.svg).toBe(expected);
  });
});
