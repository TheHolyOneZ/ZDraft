/**
 * @vitest-environment node
 *
 * A directive, not a comment: D2's WASM wants a real worker and
 * `URL.createObjectURL`, and jsdom has neither. Do not let a tidy pass
 * take this out.
 */
import { describe, expect, it } from "vitest";

import { d2Adapter } from "../engines/d2";
import { locateD2 } from "../locate/d2";
import { isGraph, nodeText } from "../model/scene";
import { d2Editor } from "./d2";

const FLAT = `direction: right

customer: Customer {shape: person}
orders: Orders
db: Ledger {shape: cylinder}

customer -> orders: places
orders -> db: writes
`;

const NESTED = `services: {
  orders: Orders
  payments: Payments
}

gateway -> services.orders
`;

describe("renaming a D2 node", () => {
  it("changes the declaration and both ends of every connection", () => {
    const edit = d2Editor.rename(FLAT, "orders", "billing")!;

    expect(edit.source).toContain("billing: Orders");
    expect(edit.source).toContain("customer -> billing: places");
    expect(edit.source).toContain("billing -> db: writes");
    expect(edit.source).not.toMatch(/\borders\b/);
  });

  it("leaves a label that merely says the same word alone", () => {
    const edit = d2Editor.rename("orders: orders\norders -> db\n", "orders", "billing")!;


    expect(edit.source).toBe("billing: orders\nbilling -> db\n");
  });


  it("follows a node across the scope it is written in", () => {
    const edit = d2Editor.rename(NESTED, "services.orders", "services.billing")!;

    expect(edit.source).toContain("  billing: Orders");
    expect(edit.source).toContain("gateway -> services.billing");
    expect(edit.source).toContain("  payments: Payments");
  });

  it("renames a container without touching the children's own names", () => {
    const edit = d2Editor.rename(NESTED, "services", "platform")!;

    expect(edit.source).toContain("platform: {");
    expect(edit.source).toContain("gateway -> platform.orders");
    expect(edit.source).toContain("  orders: Orders");
  });

  it("refuses a name D2 could not read", () => {
    expect(d2Editor.rename(FLAT, "orders", "a.b")).toBeNull();
    expect(d2Editor.rename(FLAT, "orders", "shape")).toBeNull();
    expect(d2Editor.rename(FLAT, "orders", "")).toBeNull();
  });

  it("refuses an id the file does not have", () => {
    expect(d2Editor.rename(FLAT, "nope", "x")).toBeNull();
  });

  it("names the change for the undo timeline", () => {
    expect(d2Editor.rename(FLAT, "orders", "billing")!.label).toBe("Rename orders to billing");
  });
});

describe("relabelling", () => {
  it("changes the inline label", () => {
    const edit = d2Editor.setLabel(FLAT, "orders", "Order service")!;
    expect(edit.source).toContain("orders: Order service");
  });

  it("adds one to a shape that had none", () => {
    const edit = d2Editor.setLabel("a\na -> b\n", "a", "Alpha")!;
    expect(edit.source).toBe("a: Alpha\na -> b\n");
  });

  it("quotes a label that would otherwise end the value", () => {
    const edit = d2Editor.setLabel(FLAT, "orders", "reads: writes")!;
    expect(edit.source).toContain('orders: "reads: writes"');
  });


  it("changes an explicit label key rather than adding a second one", () => {
    const source = "orders: Orders\norders.label: Order service\n";
    const edit = d2Editor.setLabel(source, "orders", "Billing")!;

    expect(edit.source).toContain("orders.label: Billing");
    expect(edit.source).toContain("orders: Orders");
  });

  it("keeps the shape block it was declared with", () => {
    const edit = d2Editor.setLabel(FLAT, "customer", "Buyer")!;
    expect(edit.source).toContain("{shape: person}");
  });
});

describe("reshaping", () => {
  it("changes a shape already in the block", () => {
    const edit = d2Editor.setShape(FLAT, "db", "queue")!;

    expect(edit.source).toContain("{shape: queue}");
    expect(edit.source).not.toContain("cylinder");
  });


  it("adds a sibling key rather than rewriting the declaration", () => {
    const edit = d2Editor.setShape(FLAT, "orders", "cylinder")!;

    expect(edit.source).toContain("orders: Orders\norders.shape: cylinder");
  });

  it("keeps the file's own indentation when it adds one", () => {
    const edit = d2Editor.setShape(NESTED, "services.payments", "cylinder")!;
    expect(edit.source).toContain("\n  payments.shape: cylinder");
  });

  it("refuses a shape D2 has no word for", () => {
    expect(d2Editor.setShape(FLAT, "orders", "note")).toBeNull();
  });
});

describe("D2's layout parameters", () => {
  const tuner = d2Editor.tuning!;

  it("reads the direction the file sets", () => {
    expect(tuner.read(FLAT)).toEqual({ direction: "right" });
    expect(tuner.read("a -> b\n")).toEqual({});
  });

  it("changes it in place", () => {
    expect(tuner.set(FLAT, "direction", "up")!.source).toContain("direction: up");
  });

  it("adds it at the top, where D2's own examples put it", () => {
    const edit = tuner.set("a -> b\n", "direction", "right")!;
    expect(edit.source).toBe("direction: right\na -> b\n");
  });

  it("takes the line out when the value goes back to D2's default", () => {
    const edit = tuner.set(FLAT, "direction", "down")!;

    expect(edit.source).not.toContain("direction");
    expect(edit.source).toContain("customer: Customer");
  });

  it("does not mistake a shape's own direction for the diagram's", () => {
    expect(tuner.read("grid: {direction: right}\n")).toEqual({});
  });
});


describe("what D2 makes of the result", () => {
  async function nodes(source: string) {
    const result = await d2Adapter.layout(source);
    if (!isGraph(result.scene)) throw new Error("expected a graph scene");

    expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    return result.scene;
  }

  it("still compiles after a rename, with the node renamed", async () => {
    const edit = d2Editor.rename(FLAT, "orders", "billing")!;
    const scene = await nodes(edit.source);

    expect(scene.nodes.map((n) => n.id).sort()).toEqual(["billing", "customer", "db"]);
    expect(scene.edges).toHaveLength(2);
  }, 60000);

  it("still compiles after a rename inside a container", async () => {
    const edit = d2Editor.rename(NESTED, "services.orders", "services.billing")!;
    const scene = await nodes(edit.source);

    expect(scene.nodes.some((n) => n.id === "services.billing")).toBe(true);
  }, 60000);

  it("draws the new label", async () => {
    const edit = d2Editor.setLabel(FLAT, "orders", "Order service")!;
    const scene = await nodes(edit.source);

    expect(nodeText(scene.nodes.find((n) => n.id === "orders")!.body)).toBe("Order service");
  }, 60000);

  it("draws every shape it offers", async () => {
    for (const shape of d2Editor.shapes) {
      const edit = d2Editor.setShape("a: A\nb: B\na -> b\n", "a", shape);
      if (!edit) continue;
      await nodes(edit.source);
    }
  }, 120000);

  it("leaves locate able to find the renamed node", () => {
    const edit = d2Editor.rename(FLAT, "orders", "billing")!;
    const index = locateD2(edit.source);

    expect(index.nodes.has("billing")).toBe(true);
    expect(index.nodes.has("orders")).toBe(false);
  });
});
