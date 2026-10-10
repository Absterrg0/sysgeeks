import type { ArchitectureComponent, ArchitectureFlow, ComponentKind, PlacedComponent } from "./content";

/** Left-to-right: callers, entry points, logic, async plumbing, state, the outside world. */
const COLUMN: Record<ComponentKind, number> = {
  client: 0,
  edge: 1,
  service: 2,
  worker: 3,
  queue: 3,
  stream: 3,
  database: 4,
  cache: 4,
  "object-store": 4,
  external: 5,
};

type Cell = { col: number; row: number };

/**
 * How the map will draw a flow from a to b, and what that costs: right angles through the gaps between parts.
 * Level neighbours are free, each row of drop costs a little, and a flow that has to leave its row and run along
 * a gap between rows to get past other parts costs a lot. `through` lists the empty cells it runs across.
 */
export function routeCost(
  a: Cell,
  b: Cell,
  isEmpty: (col: number, row: number) => boolean,
): { cost: number; through: Cell[] } {
  const dc = b.col - a.col;
  const dr = Math.abs(b.row - a.row);
  if (dc === 0) {
    for (let r = Math.min(a.row, b.row) + 1; r < Math.max(a.row, b.row); r++) {
      if (!isEmpty(a.col, r)) return { cost: 3 + dr * 0.35, through: [] };
    }
    return { cost: (dr - 1) * 0.35, through: [] };
  }
  if (Math.abs(dc) === 1) return { cost: dr * 0.35, through: [] };
  const dir = Math.sign(dc);
  const cells = (row: number) => {
    const list: Cell[] = [];
    for (let col = a.col + dir; col !== b.col; col += dir) list.push({ col, row });
    return list;
  };
  const span = Math.abs(dc) * 0.1;
  for (const row of [b.row, a.row]) {
    const run = cells(row);
    if (run.every((c) => isEmpty(c.col, c.row))) return { cost: dr * 0.35 + span, through: run };
  }
  return { cost: 3 + dr * 0.35 + span, through: [] };
}

/**
 * Places hand-described components on a grid so a learner's own model can be
 * drawn without asking them to position anything. Columns come from the kind
 * (callers left, the outside world right; empty columns dropped). Rows are
 * then searched so the flows are cheap to draw: level where possible, never
 * forced to detour round other parts when another arrangement avoids it, not
 * bundled through one corridor, and on as few rows as the model allows.
 */
export function autoLayout(
  components: readonly ArchitectureComponent[],
  flows: readonly ArchitectureFlow[] = [],
): PlacedComponent[] {
  const used = [...new Set(components.map((c) => COLUMN[c.kind]))].sort((a, b) => a - b);
  const colOf = (c: ArchitectureComponent) => used.indexOf(COLUMN[c.kind]);
  const perColumn = Math.max(0, ...used.map((_, i) => components.filter((c) => colOf(c) === i).length));
  const maxRow = Math.max(3, perColumn + 2);
  const degree = (c: ArchitectureComponent) => flows.filter((f) => f.from === c.id || f.to === c.id).length;

  const cost = (placed: Map<string, Cell>) => {
    const taken = new Set([...placed.values()].map((p) => `${p.col},${p.row}`));
    const isEmpty = (col: number, row: number) => !taken.has(`${col},${row}`);
    const crowd = new Map<string, number>();
    let total = 0;
    for (const flow of flows) {
      const a = placed.get(flow.from);
      const b = placed.get(flow.to);
      if (!a || !b) continue;
      const route = routeCost(a, b, isEmpty);
      total += route.cost;
      for (const c of route.through) crowd.set(`${c.col},${c.row}`, (crowd.get(`${c.col},${c.row}`) ?? 0) + 1);
    }
    for (const n of crowd.values()) total += Math.max(0, n - 1) * 0.45;
    total += new Set([...placed.values()].map((p) => p.row)).size * 0.6;
    for (const p of placed.values()) total += p.row * 0.01;
    return total;
  };

  const search = (order: ArchitectureComponent[]) => {
    const placed = new Map<string, Cell>();
    // Greedy first: each part takes the row that is cheapest given the parts already placed.
    for (const component of order) {
      const col = colOf(component);
      let best: { row: number; cost: number } | null = null;
      for (let row = 0; row < maxRow; row++) {
        if ([...placed.values()].some((p) => p.col === col && p.row === row)) continue;
        placed.set(component.id, { col, row });
        const here = cost(placed);
        if (!best || here < best.cost - 1e-9) best = { row, cost: here };
      }
      placed.set(component.id, { col, row: best?.row ?? 0 });
    }
    // Then improve: move or swap each part within its column to its cheapest row, until nothing improves.
    for (let pass = 0; pass < 10; pass++) {
      let improved = false;
      for (const component of order) {
        const current = placed.get(component.id) as Cell;
        const moveTo = (row: number) => {
          const occupant = [...placed].find(([, p]) => p.col === current.col && p.row === row)?.[0];
          placed.set(component.id, { col: current.col, row });
          if (occupant) placed.set(occupant, { col: current.col, row: current.row });
          return () => {
            placed.set(component.id, current);
            if (occupant) placed.set(occupant, { col: current.col, row });
          };
        };
        let bestRow = current.row;
        let bestCost = cost(placed);
        for (let row = 0; row < maxRow; row++) {
          if (row === current.row) continue;
          const undo = moveTo(row);
          const here = cost(placed);
          if (here < bestCost - 1e-9) {
            bestCost = here;
            bestRow = row;
          }
          undo();
        }
        if (bestRow !== current.row) {
          moveTo(bestRow);
          improved = true;
        }
      }
      if (!improved) break;
    }
    return placed;
  };

  // A few deterministic starting orders; keep whichever ends cheapest.
  const byColumn = (list: ArchitectureComponent[]) => [...list].sort((a, b) => colOf(a) - colOf(b));
  const starts = [
    byColumn([...components].sort((a, b) => degree(b) - degree(a))),
    byColumn([...components]),
    byColumn([...components].reverse()),
    [...components].sort((a, b) => degree(b) - degree(a)),
  ];
  let placed = search(starts[0] as ArchitectureComponent[]);
  let best = cost(placed);
  for (const order of starts.slice(1)) {
    const candidate = search(order);
    const here = cost(candidate);
    if (here < best - 1e-9) {
      placed = candidate;
      best = here;
    }
  }

  // Close up rows nothing landed in so the map stays compact. Order is preserved.
  const rows = [...new Set([...placed.values()].map((p) => p.row))].sort((a, b) => a - b);
  for (const [id, p] of placed) placed.set(id, { col: p.col, row: rows.indexOf(p.row) });
  return components.map((c) => ({ ...c, position: placed.get(c.id) ?? { col: colOf(c), row: 0 } }));
}

/** The longest slug, matching the AI schemas' kebab-case ids. */
const MAX_SLUG = 40;

export function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG)
    .replace(/-+$/g, "");
  return slug || "item";
}

/** A slug for `text` that does not collide with `taken`, still at most `MAX_SLUG` characters. */
export function uniqueSlug(text: string, taken: Iterable<string>): string {
  const existing = new Set(taken);
  const base = slugify(text);
  if (!existing.has(base)) return base;
  for (let i = 2; ; i++) {
    const suffix = `-${i}`;
    const candidate = `${base.slice(0, MAX_SLUG - suffix.length).replace(/-+$/g, "")}${suffix}`;
    if (!existing.has(candidate)) return candidate;
  }
}
