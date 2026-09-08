import { overlapArea, rectCenter, rectsOverlap, type Point, type Rect } from "../model/geometry";
import type { Diagnostic, GraphScene } from "../model/scene";


const MIN_AREA = 4;

export interface OverlapPair {
  a: string;
  b: string;
  area: number;
}

export function findOverlaps(scene: GraphScene): OverlapPair[] {
  const pairs: OverlapPair[] = [];
  const nodes = scene.nodes;


  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i]!;
      const b = nodes[j]!;
      if (!rectsOverlap(a.rect, b.rect)) continue;

      const area = overlapArea(a.rect, b.rect);
      if (area >= MIN_AREA) pairs.push({ a: a.id, b: b.id, area });
    }
  }

  return pairs.sort((x, y) => y.area - x.area);
}

export function overlapDiagnostics(scene: GraphScene): Diagnostic[] {
  const pairs = findOverlaps(scene);
  if (pairs.length === 0) return [];

  const involved = [...new Set(pairs.flatMap((p) => [p.a, p.b]))];

  return [
    {
      severity: "warning",
      message:
        involved.length === 2
          ? `“${involved[0]}” and “${involved[1]}” overlap.`
          : `${involved.length} nodes overlap.`,
      nodes: involved,
      fix: { kind: "separate-nodes", nodes: involved },
    },
  ];
}


export function separateNodes(
  scene: GraphScene,
  ids: readonly string[],
  gap = 12,
  rounds = 24,
): Map<string, Point> {
  const movable = new Set(ids);
  const rects = new Map<string, Rect>(scene.nodes.map((n) => [n.id, { ...n.rect }]));

  for (let round = 0; round < rounds; round++) {
    let moved = false;

    for (let i = 0; i < scene.nodes.length; i++) {
      for (let j = i + 1; j < scene.nodes.length; j++) {
        const aId = scene.nodes[i]!.id;
        const bId = scene.nodes[j]!.id;
        const a = rects.get(aId)!;
        const b = rects.get(bId)!;

        const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) + gap;
        const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) + gap;
        if (overlapX <= 0 || overlapY <= 0) continue;

        const ca = rectCenter(a);
        const cb = rectCenter(b);


        let dx = 0;
        let dy = 0;
        if (overlapX < overlapY) {
          dx = (overlapX / 2) * (ca.x <= cb.x ? -1 : 1);
        } else {
          dy = (overlapY / 2) * (ca.y <= cb.y ? -1 : 1);
        }

        const aMovable = movable.has(aId);
        const bMovable = movable.has(bId);
        if (!aMovable && !bMovable) continue;


        const scale = aMovable && bMovable ? 1 : 2;
        if (aMovable) {
          a.x += dx * scale;
          a.y += dy * scale;
        }
        if (bMovable) {
          b.x -= dx * scale;
          b.y -= dy * scale;
        }

        moved = true;
      }
    }

    if (!moved) break;
  }

  const result = new Map<string, Point>();
  for (const id of ids) {
    const rect = rects.get(id);
    if (rect) result.set(id, rectCenter(rect));
  }
  return result;
}
