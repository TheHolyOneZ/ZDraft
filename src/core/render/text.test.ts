import { describe, expect, it } from "vitest";

import { fitLabel, labelBlock, measureText } from "./text";

describe("fitLabel", () => {
  it("keeps a label that fits at full size", () => {
    expect(fitLabel("API", { w: 100, h: 30 }, 13)).toEqual({ lines: ["API"], size: 13 });
  });

  it("shrinks a single word rather than breaking it in two", () => {
    const width = measureText("Redis", 13, 500);
    const fitted = fitLabel("Redis", { w: width * 0.7, h: 40 }, 13);

    expect(fitted.lines).toEqual(["Redis"]);
    expect(fitted.size).toBeLessThan(13);
    expect(measureText("Redis", fitted.size, 500)).toBeLessThanOrEqual(width * 0.7 + 0.5);
  });

  it("wraps between words before it touches a word", () => {
    const fitted = fitLabel("Load balancer pool", { w: measureText("balancer", 13, 500) + 2, h: 80 }, 13);
    expect(fitted.lines.every((line) => /^(Load|balancer|pool)( |$)/.test(line))).toBe(true);
  });

  it("still breaks a word that cannot fit even small", () => {
    const fitted = fitLabel("Supercalifragilistic", { w: 30, h: 200 }, 13);
    expect(fitted.lines.length).toBeGreaterThan(1);
  });
});

describe("labelBlock", () => {
  it("stacks one row per line around the anchor", () => {
    const block = labelBlock("a\nb", { x: 50, y: 50 }, 12);
    expect(block.rows.map((r) => r.text)).toEqual(["a", "b"]);
    expect(block.rows[1]!.y).toBeGreaterThan(block.rows[0]!.y);
    expect(block.box.y + block.box.h / 2).toBeCloseTo(50);
  });
});
