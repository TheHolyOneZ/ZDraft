/**
 * @vitest-environment node
 *
 * A directive, not a comment: D2's WASM wants a real worker and
 * `URL.createObjectURL`, and jsdom has neither. Do not let a tidy pass
 * take this out.
 */
import { describe, expect, it } from "vitest";

import { d2Adapter } from "../engines/d2";
import { graphvizAdapter } from "../engines/graphviz";
import { detectMermaidType, familyForMermaidType, parseMermaid } from "../locate/mermaid";
import { nodeText } from "../model/scene";
import { parseSequence } from "../locate/sequence";
import { EXTENSION_FOR } from "../starters";
import { TEMPLATES, templateById, templatesByCategory } from ".";

describe("the template catalogue", () => {
  it("gives every template a unique id", () => {
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(TEMPLATES.length);
  });

  it("finds one by id", () => {
    expect(templateById("c4-context")?.category).toBe("architecture");
    expect(templateById("nope")).toBeUndefined();
  });

  it("groups every template into a category, and drops none", () => {
    const grouped = templatesByCategory().flatMap((g) => g.items);
    expect(grouped).toHaveLength(TEMPLATES.length);
  });

  it("knows an extension for every engine a template uses", () => {
    for (const template of TEMPLATES) {
      expect(EXTENSION_FOR[template.engine], template.id).toMatch(/^\./);
    }
  });


  it("is a worked example rather than a stub", () => {
    for (const template of TEMPLATES) {
      const lines = template.source.trim().split("\n").filter((l) => l.trim() !== "");
      expect(lines.length, template.id).toBeGreaterThan(10);
    }
  });


  it("does not turn a box into a container by accident", async () => {
    for (const template of TEMPLATES.filter((t) => t.engine === "d2")) {
      const result = await d2Adapter.layout(template.source);
      if (result.scene.family !== "graph") throw new Error(`${template.id}: not a graph`);

      for (const cluster of result.scene.clusters) {
        const members = result.scene.nodes.filter((n) => n.parent === cluster.id);
        expect(members.length, `${template.id}: ${cluster.id}`).toBeGreaterThan(1);
      }
    }
  }, 60000);


  it("never shows an escape sequence where a line break was meant", async () => {
    for (const template of TEMPLATES) {
      const adapter = template.engine === "d2" ? d2Adapter : graphvizAdapter;
      if (template.engine === "mermaid") continue;

      const result = await adapter.layout(template.source);
      if (result.scene.family !== "graph") continue;

      for (const node of result.scene.nodes) {
        expect(nodeText(node.body), `${template.id}: ${node.id}`).not.toContain("\\n");
      }
    }
  }, 60000);

  it("says what each one is for, not what it contains", () => {
    for (const template of TEMPLATES) {
      expect(template.name.length, template.id).toBeGreaterThan(3);
      expect(template.description.length, template.id).toBeGreaterThan(20);
      expect(template.description.endsWith("."), template.id).toBe(true);
    }
  });
});


describe("every template renders", () => {
  it("lays out the Graphviz ones without an error", async () => {
    for (const template of TEMPLATES.filter((t) => t.engine === "graphviz")) {
      const result = await graphvizAdapter.layout(template.source);

      expect(result.diagnostics.filter((d) => d.severity === "error"), template.id).toEqual([]);
      if (result.scene.family !== "graph") throw new Error(`${template.id}: not a graph`);
      expect(result.scene.nodes.length, template.id).toBeGreaterThan(2);
    }
  }, 30000);

  it("lays out the D2 ones without an error", async () => {
    for (const template of TEMPLATES.filter((t) => t.engine === "d2")) {
      const result = await d2Adapter.layout(template.source);

      expect(result.diagnostics.filter((d) => d.severity === "error"), template.id).toEqual([]);
      if (result.scene.family !== "graph") throw new Error(`${template.id}: not a graph`);
      expect(result.scene.nodes.length, template.id).toBeGreaterThan(2);
    }
  }, 60000);

  it("parses the Mermaid ones into the diagram type they claim", () => {
    for (const template of TEMPLATES.filter((t) => t.engine === "mermaid")) {
      const type = detectMermaidType(template.source);
      expect(type, template.id).not.toBe("unknown");

      if (familyForMermaidType(type) === "sequence") {
        expect(parseSequence(template.source).participants.length, template.id).toBeGreaterThan(2);
      } else {
        const model = parseMermaid(template.source);
        expect(model.nodes.size + model.subgraphs.length, template.id).toBeGreaterThan(2);
      }
    }
  });


  it("ships no warnings either", async () => {
    for (const template of TEMPLATES.filter((t) => t.engine === "graphviz")) {
      const result = await graphvizAdapter.layout(template.source);
      const warnings = result.diagnostics.filter((d) => d.severity === "warning");
      expect(warnings.map((w) => w.message), template.id).toEqual([]);
    }
  }, 30000);
});
