import { simplifyPolyline, type Point, type Rect } from "../model/geometry";


export interface RouteGrid {

  cell: number;
  origin: Point;
  cols: number;
  rows: number;

  blocked: Uint8Array;
}


export const DEFAULT_CELL = 12;


export const CLEARANCE = 6;

export function buildGrid(
  bounds: Rect,
  obstacles: readonly Rect[],
  cell = DEFAULT_CELL,
  clearance = CLEARANCE,
): RouteGrid {


  const origin = { x: bounds.x - cell, y: bounds.y - cell };
  const cols = Math.max(1, Math.ceil((bounds.w + cell * 2) / cell) + 1);
  const rows = Math.max(1, Math.ceil((bounds.h + cell * 2) / cell) + 1);
  const blocked = new Uint8Array(cols * rows);

  for (const rect of obstacles) {
    const x0 = Math.floor((rect.x - clearance - origin.x) / cell);
    const y0 = Math.floor((rect.y - clearance - origin.y) / cell);
    const x1 = Math.ceil((rect.x + rect.w + clearance - origin.x) / cell);
    const y1 = Math.ceil((rect.y + rect.h + clearance - origin.y) / cell);

    for (let y = Math.max(0, y0); y < Math.min(rows, y1); y++) {
      for (let x = Math.max(0, x0); x < Math.min(cols, x1); x++) {
        blocked[y * cols + x] = 1;
      }
    }
  }

  return { cell, origin, cols, rows, blocked };
}


export function setRectBlocked(
  grid: RouteGrid,
  rect: Rect,
  value: 0 | 1,
  clearance = CLEARANCE,
): void {
  const x0 = Math.floor((rect.x - clearance - grid.origin.x) / grid.cell);
  const y0 = Math.floor((rect.y - clearance - grid.origin.y) / grid.cell);
  const x1 = Math.ceil((rect.x + rect.w + clearance - grid.origin.x) / grid.cell);
  const y1 = Math.ceil((rect.y + rect.h + clearance - grid.origin.y) / grid.cell);

  for (let y = Math.max(0, y0); y < Math.min(grid.rows, y1); y++) {
    for (let x = Math.max(0, x0); x < Math.min(grid.cols, x1); x++) {
      grid.blocked[y * grid.cols + x] = value;
    }
  }
}

function toCell(grid: RouteGrid, p: Point): { x: number; y: number } {
  return {
    x: Math.round((p.x - grid.origin.x) / grid.cell),
    y: Math.round((p.y - grid.origin.y) / grid.cell),
  };
}

function toWorld(grid: RouteGrid, x: number, y: number): Point {
  return { x: grid.origin.x + x * grid.cell, y: grid.origin.y + y * grid.cell };
}

function inside(grid: RouteGrid, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < grid.cols && y < grid.rows;
}


function clearAround(grid: RouteGrid, p: Point, radius = 1): void {
  const c = toCell(grid, p);
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const x = c.x + dx;
      const y = c.y + dy;
      if (inside(grid, x, y)) grid.blocked[y * grid.cols + x] = 0;
    }
  }
}


const TURN_PENALTY = 3;


export function hasLineOfSight(grid: RouteGrid, a: Point, b: Point): boolean {
  const span = Math.hypot(b.x - a.x, b.y - a.y);
  const steps = Math.max(1, Math.ceil((span / grid.cell) * 2));

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const c = toCell(grid, { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    if (!inside(grid, c.x, c.y)) return false;
    if (grid.blocked[c.y * grid.cols + c.x]) return false;
  }

  return true;
}


function pullString(grid: RouteGrid, path: readonly Point[]): Point[] {
  if (path.length <= 2) return [...path];

  const out: Point[] = [path[0]!];
  let i = 0;

  while (i < path.length - 1) {
    let furthest = i + 1;
    for (let j = path.length - 1; j > i + 1; j--) {
      if (hasLineOfSight(grid, path[i]!, path[j]!)) {
        furthest = j;
        break;
      }
    }
    out.push(path[furthest]!);
    i = furthest;
  }

  return out;
}


export function routeOrthogonal(
  grid: RouteGrid,
  from: Point,
  to: Point,
  maxExpansions = 20_000,
): Point[] | null {
  clearAround(grid, from);
  clearAround(grid, to);

  const start = toCell(grid, from);
  const goal = toCell(grid, to);
  if (!inside(grid, start.x, start.y) || !inside(grid, goal.x, goal.y)) return null;

  const { cols, rows, blocked } = grid;
  const size = cols * rows;


  const stateCount = size * 5;
  const gScore = new Float64Array(stateCount).fill(Infinity);
  const cameFrom = new Int32Array(stateCount).fill(-1);
  const closed = new Uint8Array(stateCount);

  const DIRS = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ];

  const heuristic = (x: number, y: number) => Math.abs(x - goal.x) + Math.abs(y - goal.y);
  const stateOf = (x: number, y: number, dir: number) => (y * cols + x) * 5 + dir;

  const startState = stateOf(start.x, start.y, 4);
  gScore[startState] = 0;


  const heap: Array<{ f: number; state: number }> = [{ f: heuristic(start.x, start.y), state: startState }];

  const push = (f: number, state: number) => {
    heap.push({ f, state });
    let i = heap.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (heap[parent]!.f <= heap[i]!.f) break;
      [heap[parent], heap[i]] = [heap[i]!, heap[parent]!];
      i = parent;
    }
  };

  const pop = () => {
    const top = heap[0]!;
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let smallest = i;
        if (l < heap.length && heap[l]!.f < heap[smallest]!.f) smallest = l;
        if (r < heap.length && heap[r]!.f < heap[smallest]!.f) smallest = r;
        if (smallest === i) break;
        [heap[smallest], heap[i]] = [heap[i]!, heap[smallest]!];
        i = smallest;
      }
    }
    return top;
  };

  let expansions = 0;
  let goalState = -1;

  while (heap.length > 0) {
    if (++expansions > maxExpansions) return null;

    const { state } = pop();
    if (closed[state]) continue;
    closed[state] = 1;

    const cellIndex = Math.floor(state / 5);
    const dir = state % 5;
    const x = cellIndex % cols;
    const y = Math.floor(cellIndex / cols);

    if (x === goal.x && y === goal.y) {
      goalState = state;
      break;
    }

    for (let d = 0; d < 4; d++) {
      const nx = x + DIRS[d]!.dx;
      const ny = y + DIRS[d]!.dy;
      if (!inside(grid, nx, ny) || blocked[ny * cols + nx]) continue;

      const next = stateOf(nx, ny, d);
      if (closed[next]) continue;

      const turn = dir !== 4 && dir !== d ? TURN_PENALTY : 0;
      const tentative = gScore[state]! + 1 + turn;
      if (tentative >= gScore[next]!) continue;

      gScore[next] = tentative;
      cameFrom[next] = state;
      push(tentative + heuristic(nx, ny), next);
    }
  }

  if (goalState < 0) return null;

  const cells: Point[] = [];
  for (let s: number = goalState; s >= 0; s = cameFrom[s]!) {
    const cellIndex = Math.floor(s / 5);
    cells.push(toWorld(grid, cellIndex % cols, Math.floor(cellIndex / cols)));
    if (cameFrom[s] === -1) break;
  }
  cells.reverse();


  const path = [from, ...cells.slice(1, -1), to];
  return simplifyPolyline(pullString(grid, path));
}
