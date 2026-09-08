import { describe, expect, it } from "vitest";

import { align, distribute, space, type Placed } from ".";


function box(id: string, x: number, y: number, w = 100, h = 50): Placed {
  return { id, rect: { x, y, w, h } };
}

const row: Placed[] = [box("a", 0, 0, 100, 50), box("b", 200, 20, 60, 80), box("c", 400, 5, 40, 30)];

describe("align", () => {
  it("does nothing to fewer than two nodes", () => {
    expect(align([box("a", 0, 0)], "left").size).toBe(0);
    expect(align([], "top").size).toBe(0);
  });

  it("puts every left edge on the leftmost one", () => {
    const moved = align(row, "left");

    for (const node of row) {
      const centre = moved.get(node.id)!;
      expect(centre.x - node.rect.w / 2, node.id).toBeCloseTo(0, 6);
    }
  });

  it("puts every right edge on the rightmost one", () => {
    const moved = align(row, "right");

    for (const node of row) {
      const centre = moved.get(node.id)!;
      expect(centre.x + node.rect.w / 2, node.id).toBeCloseTo(440, 6);
    }
  });


  it("puts every centre on the middle of the extent", () => {
    const moved = align(row, "center-x");
    for (const node of row) expect(moved.get(node.id)!.x).toBeCloseTo(220, 6);
  });

  it("leaves the other axis exactly where it was", () => {
    const moved = align(row, "left");
    for (const node of row) {
      expect(moved.get(node.id)!.y).toBeCloseTo(node.rect.y + node.rect.h / 2, 6);
    }
  });

  it("aligns tops, bottoms and middles the same way", () => {
    const top = align(row, "top");
    for (const node of row) expect(top.get(node.id)!.y - node.rect.h / 2).toBeCloseTo(0, 6);

    const bottom = align(row, "bottom");
    for (const node of row) expect(bottom.get(node.id)!.y + node.rect.h / 2).toBeCloseTo(100, 6);

    const middle = align(row, "middle-y");
    for (const node of row) expect(middle.get(node.id)!.y).toBeCloseTo(50, 6);
  });


  it("gives the same answer whatever order the nodes arrive in", () => {
    const forwards = align(row, "left");
    const backwards = align([...row].reverse(), "left");

    for (const [id, point] of forwards) {
      expect(backwards.get(id)).toEqual(point);
    }
  });
});

describe("distribute", () => {
  it("needs three nodes before there is anything to even out", () => {
    expect(distribute([box("a", 0, 0), box("b", 100, 0)], "horizontal").size).toBe(0);
  });

  it("leaves the outermost two alone", () => {
    const moved = distribute(row, "horizontal");

    expect(moved.has("a")).toBe(false);
    expect(moved.has("c")).toBe(false);
    expect(moved.has("b")).toBe(true);
  });


  it("makes the gaps equal, not the centres", () => {
    const nodes = [box("a", 0, 0, 100, 20), box("b", 150, 0, 20, 20), box("c", 400, 0, 100, 20)];
    const moved = distribute(nodes, "horizontal");

    const b = moved.get("b")!;
    const bLeft = b.x - 10;
    const bRight = b.x + 10;

    expect(bLeft - 100).toBeCloseTo(400 - bRight, 6);
  });

  it("keeps the span it was given", () => {
    const moved = distribute(row, "horizontal");
    const b = moved.get("b")!;

    expect(b.x).toBeGreaterThan(0);
    expect(b.x).toBeLessThan(440);
  });

  it("works down the page as readily as across", () => {
    const column = [box("a", 0, 0, 50, 40), box("b", 0, 60, 50, 20), box("c", 0, 300, 50, 40)];
    const moved = distribute(column, "vertical");

    const b = moved.get("b")!;
    expect(b.y - 10 - 40).toBeCloseTo(300 - (b.y + 10), 6);

    expect(b.x).toBeCloseTo(25, 6);
  });

  it("sorts by position rather than trusting the order it was handed", () => {
    const shuffled = [row[2]!, row[0]!, row[1]!];
    expect(distribute(shuffled, "horizontal").has("b")).toBe(true);
  });


  it("does not fall over when the boxes already overlap", () => {
    const crowded = [box("a", 0, 0, 100, 20), box("b", 10, 0, 100, 20), box("c", 20, 0, 100, 20)];
    const moved = distribute(crowded, "horizontal");

    expect(moved.size).toBe(1);
    expect(Number.isFinite(moved.get("b")!.x)).toBe(true);
  });
});

describe("space", () => {
  it("sets the gap and lets the span follow", () => {
    const moved = space(row, "horizontal", 20);

    const a = moved.get("a")!;
    const b = moved.get("b")!;
    const c = moved.get("c")!;

    expect(b.x - 30 - (a.x + 50)).toBeCloseTo(20, 6);
    expect(c.x - 20 - (b.x + 30)).toBeCloseTo(20, 6);
  });

  it("does not move the first node", () => {
    const moved = space(row, "horizontal", 20);
    expect(moved.get("a")!.x).toBeCloseTo(50, 6);
  });

  it("accepts a zero gap, which butts the boxes together", () => {
    const moved = space([box("a", 0, 0, 100, 20), box("b", 500, 0, 100, 20)], "horizontal", 0);
    expect(moved.get("b")!.x - 50).toBeCloseTo(100, 6);
  });

  it("needs two nodes", () => {
    expect(space([box("a", 0, 0)], "horizontal", 8).size).toBe(0);
  });
});
