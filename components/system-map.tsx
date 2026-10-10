"use client";

import { useId, useState, type CSSProperties, type ReactNode } from "react";
import type { ArchitectureFlow, ComponentKind, FlowKind, PlacedComponent } from "@/lib/domain/content";

const CELL_W = 186;
const CELL_H = 104;
const BOX_W = 128;
const BOX_H = 62;
const PAD = 12;

export const KIND_LABEL: Record<ComponentKind, string> = {
  client: "client",
  edge: "edge",
  service: "service",
  worker: "worker",
  database: "database",
  queue: "queue",
  "object-store": "object store",
  cache: "cache",
  stream: "log / stream",
  external: "external",
};

const FLOW_STYLE: Record<FlowKind, { dash?: string; width: number; label: string }> = {
  request: { width: 1.4, label: "Request / response" },
  async: { dash: "6 4", width: 1.4, label: "Asynchronous" },
  data: { width: 3, label: "Bulk data" },
  push: { dash: "1.5 3.5", width: 1.8, label: "Server push" },
};

/** A short sample of how a kind of flow is drawn, for keys and tables. */
export function FlowLine({ kind, width = 22 }: { kind: FlowKind; width?: number }) {
  return (
    <svg width={width} height="6" aria-hidden="true" className="shrink-0">
      <line
        x1="0"
        y1="3"
        x2={width}
        y2="3"
        stroke="var(--ink-3)"
        strokeWidth={FLOW_STYLE[kind].width}
        strokeDasharray={FLOW_STYLE[kind].dash}
      />
    </svg>
  );
}

export const FLOW_LABEL: Record<FlowKind, string> = {
  request: FLOW_STYLE.request.label,
  async: FLOW_STYLE.async.label,
  data: FLOW_STYLE.data.label,
  push: FLOW_STYLE.push.label,
};

type Point = { x: number; y: number };

function center(c: PlacedComponent, origin: { col: number; row: number }): Point {
  return {
    x: PAD + (c.position.col - origin.col) * CELL_W + CELL_W / 2,
    y: PAD + (c.position.row - origin.row) * CELL_H + CELL_H / 2,
  };
}

function splitLabel(label: string): string[] {
  if (label.length <= 16) return [label];
  const words = label.split(" ");
  let best: [string, string] = [label, ""];
  let bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(" ");
    const b = words.slice(i).join(" ");
    const diff = Math.abs(a.length - b.length);
    if (diff < bestDiff) {
      best = [a, b];
      bestDiff = diff;
    }
  }
  return best[1] ? best : [label];
}

type Geometry = {
  flow: ArchitectureFlow;
  path: string;
  mid: Point;
  number: number;
  extent: { minX: number; maxX: number; minY: number; maxY: number };
  /** Spots for the flow's number, best first: along its longest runs. */
  spots: Point[];
  /** The corners of the drawn line, before rounding. */
  points: Point[];
};

/** Distance from p to the segment a→b. */
function toSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = dx === 0 && dy === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}

/**
 * Puts each flow's number on a stretch of its own line that no other line runs beside, away from the other
 * numbers; failing that, just away from the other numbers.
 */
function separateBadges(geometry: Geometry[]): Geometry[] {
  const placed: Point[] = [];
  const clearOfLines = (p: Point, self: Geometry) =>
    geometry.every(
      (g) => g === self || g.points.slice(1).every((end, i) => toSegment(p, g.points[i] as Point, end) > 10),
    );
  const clearOfBadges = (p: Point) => placed.every((q) => Math.hypot(p.x - q.x, p.y - q.y) > 21);
  return geometry.map((g) => {
    const spot =
      g.spots.find((p) => clearOfBadges(p) && clearOfLines(p, g)) ?? g.spots.find(clearOfBadges) ?? g.mid;
    placed.push(spot);
    return { ...g, mid: spot };
  });
}

type Side = "left" | "right" | "top" | "bottom";
type Cell = { col: number; row: number };

/** How a flow is drawn before ports and lanes are spread: which sides it leaves and enters, and where it turns. */
type Route = {
  flow: ArchitectureFlow;
  index: number;
  from: { id: string; side: Side };
  to: { id: string; side: Side };
  /** The column gaps (k = the gap right of column k) its vertical runs use, in order. */
  gaps: number[];
  /** The row gap (r = the gap under row r) its horizontal run uses, if it needs one. */
  rowGap?: number;
};

const ARROW_GAP = 3;
const PORT_MARGIN = 9;
const LANE = 9;
const CORNER = 7;

/**
 * Routes every flow as right angles through the gaps between parts, so no line crosses a box: out of the side
 * facing the other part, along the gap between columns, across the gap between rows when the way is blocked, and
 * into the far side. Lines sharing a side or a gap are spread apart, and corners are rounded.
 */
function flowGeometry(
  flows: ArchitectureFlow[],
  byId: Map<string, PlacedComponent>,
  origin: { col: number; row: number },
): Geometry[] {
  const cellOf = (id: string): Cell | undefined => {
    const c = byId.get(id);
    return c ? { col: c.position.col - origin.col, row: c.position.row - origin.row } : undefined;
  };
  const occupied = new Set([...byId.values()].map((c) => `${c.position.col - origin.col},${c.position.row - origin.row}`));
  const empty = (col: number, row: number) => !occupied.has(`${col},${row}`);
  const lastCol = Math.max(0, ...[...byId.values()].map((c) => c.position.col - origin.col));
  const colGapX = (k: number) => PAD + (k + 1) * CELL_W;
  const rowGapY = (r: number) => PAD + (r + 1) * CELL_H;
  const centerOf = (cell: Cell) => ({ x: PAD + cell.col * CELL_W + CELL_W / 2, y: PAD + cell.row * CELL_H + CELL_H / 2 });

  const routes: Route[] = flows.flatMap((flow, index) => {
    const a = cellOf(flow.from);
    const b = cellOf(flow.to);
    if (!a || !b || flow.from === flow.to) return [];
    const dc = b.col - a.col;
    if (dc === 0) {
      const lo = Math.min(a.row, b.row);
      const hi = Math.max(a.row, b.row);
      let clear = true;
      for (let r = lo + 1; r < hi; r++) if (!empty(a.col, r)) clear = false;
      if (clear) {
        const down = b.row > a.row;
        return [{ flow, index, from: { id: flow.from, side: down ? "bottom" : "top" }, to: { id: flow.to, side: down ? "top" : "bottom" }, gaps: [] }];
      }
      // Something sits between them in the column: go round it through the gap beside the column.
      const side: Side = a.col < lastCol ? "right" : "left";
      return [{ flow, index, from: { id: flow.from, side }, to: { id: flow.to, side }, gaps: [side === "right" ? a.col : a.col - 1] }];
    }
    const dir = Math.sign(dc);
    const from = { id: flow.from, side: (dir > 0 ? "right" : "left") as Side };
    const to = { id: flow.to, side: (dir > 0 ? "left" : "right") as Side };
    const firstGap = dir > 0 ? a.col : a.col - 1;
    const lastGap = dir > 0 ? b.col - 1 : b.col;
    if (Math.abs(dc) === 1) return [{ flow, index, from, to, gaps: [firstGap] }];
    const between = (row: number) => {
      for (let col = a.col + dir; col !== b.col; col += dir) if (!empty(col, row)) return false;
      return true;
    };
    // Turn once if the target's row, or the source's, is open all the way across.
    if (between(b.row)) return [{ flow, index, from, to, gaps: [firstGap] }];
    if (between(a.row)) return [{ flow, index, from, to, gaps: [lastGap] }];
    // Otherwise drop into the row gap nearest both ends and run along it.
    const ya = centerOf(a).y;
    const yb = centerOf(b).y;
    let rowGap = -1;
    let best = Infinity;
    for (let r = -1; r <= Math.max(a.row, b.row); r++) {
      const y = rowGapY(r);
      const cost = Math.abs(ya - y) + Math.abs(y - yb) + Math.abs(y - (ya + yb) / 2) * 0.01;
      if (cost < best) {
        best = cost;
        rowGap = r;
      }
    }
    return [{ flow, index, from, to, gaps: [firstGap, lastGap], rowGap }];
  });

  // Spread the lines that share a side of a box, ordered by where their other end is so they do not cross.
  const ports = new Map<string, { route: Route; end: "from" | "to" }[]>();
  for (const route of routes) {
    for (const end of ["from", "to"] as const) {
      const key = `${route[end].id}:${route[end].side}`;
      ports.set(key, [...(ports.get(key) ?? []), { route, end }]);
    }
  }
  const portOffset = new Map<string, number>();
  for (const [key, list] of ports) {
    const side = key.split(":")[1] as Side;
    const vertical = side === "left" || side === "right";
    const other = (r: Route, end: "from" | "to") => {
      const cell = cellOf(end === "from" ? r.flow.to : r.flow.from) as Cell;
      const c = centerOf(cell);
      // A line that runs along a row gap leaves towards that gap.
      if (vertical && r.rowGap !== undefined) return rowGapY(r.rowGap);
      return vertical ? c.y : c.x;
    };
    list.sort((p, q) => other(p.route, p.end) - other(q.route, q.end) || p.route.index - q.route.index);
    const span = (vertical ? BOX_H : BOX_W) - PORT_MARGIN * 2;
    const step = list.length > 1 ? Math.min(vertical ? 11 : 18, span / (list.length - 1)) : 0;
    list.forEach((p, i) => portOffset.set(`${p.route.index}:${p.end}`, (i - (list.length - 1) / 2) * step));
  }

  const portPoint = (route: Route, end: "from" | "to"): Point => {
    const { id, side } = route[end];
    const c = centerOf(cellOf(id) as Cell);
    const o = portOffset.get(`${route.index}:${end}`) ?? 0;
    const gap = end === "to" ? ARROW_GAP : 0;
    if (side === "left") return { x: c.x - BOX_W / 2 - gap, y: c.y + o };
    if (side === "right") return { x: c.x + BOX_W / 2 + gap, y: c.y + o };
    if (side === "top") return { x: c.x + o, y: c.y - BOX_H / 2 - gap };
    return { x: c.x + o, y: c.y + BOX_H / 2 + gap };
  };

  // Spread the vertical runs that share a column gap, and the horizontal runs that share a row gap.
  // A vertical run enters its gap at one height and leaves at another. Ordering the runs in a gap by which way
  // they turn keeps them from crossing: of two lines heading right and down, the one that enters higher takes
  // the lane further right; heading right and up, further left; and mirrored for lines heading left.
  const colLanes = new Map<number, { route: Route; key: string; rank: [number, number] }[]>();
  const rowLanes = new Map<number, { route: Route; x: number }[]>();
  for (const route of routes) {
    const p = portPoint(route, "from");
    const q = portPoint(route, "to");
    const rightward = q.x >= p.x;
    route.gaps.forEach((gap, i) => {
      if (route.rowGap === undefined && Math.abs(p.y - q.y) < 0.5) return;
      const rowY = route.rowGap === undefined ? 0 : rowGapY(route.rowGap);
      const entry = route.rowGap === undefined || i === 0 ? p.y : rowY;
      const exit = route.rowGap === undefined || i === 1 ? q.y : rowY;
      const down = exit > entry;
      const rank: [number, number] = rightward
        ? down
          ? [3, -entry]
          : [2, entry]
        : down
          ? [0, entry]
          : [1, -entry];
      colLanes.set(gap, [...(colLanes.get(gap) ?? []), { route, key: `${route.index}:${i}`, rank }]);
    });
    if (route.rowGap !== undefined) rowLanes.set(route.rowGap, [...(rowLanes.get(route.rowGap) ?? []), { route, x: (p.x + q.x) / 2 }]);
  }
  const laneOffset = new Map<string, number>();
  for (const list of colLanes.values()) {
    list.sort((p, q) => p.rank[0] - q.rank[0] || p.rank[1] - q.rank[1] || p.route.index - q.route.index);
    const step = Math.min(LANE, (CELL_W - BOX_W - 16) / Math.max(1, list.length - 1));
    list.forEach((l, i) => laneOffset.set(`c${l.key}`, (i - (list.length - 1) / 2) * step));
  }
  for (const [gap, list] of rowLanes) {
    list.sort((p, q) => p.x - q.x || p.route.index - q.route.index);
    const step = Math.min(LANE, (CELL_H - BOX_H - 12) / Math.max(1, list.length - 1));
    list.forEach((l, i) => laneOffset.set(`r${gap}:${l.route.index}`, (i - (list.length - 1) / 2) * step));
  }

  return routes.map((route) => {
    const p = portPoint(route, "from");
    const q = portPoint(route, "to");
    const vertical = route.from.side === "top" || route.from.side === "bottom";
    let points: Point[];
    if (vertical) {
      // Straight down (or up) a column; jog across the row gap if the ports are not level.
      const gy = (p.y + q.y) / 2;
      points = Math.abs(p.x - q.x) < 0.5 ? [p, q] : [p, { x: p.x, y: gy }, { x: q.x, y: gy }, q];
    } else if (route.rowGap === undefined) {
      const gap = route.gaps[0] as number;
      const x = colGapX(gap) + (laneOffset.get(`c${route.index}:0`) ?? 0);
      points = Math.abs(p.y - q.y) < 0.5 && route.from.side !== route.to.side ? [p, q] : [p, { x, y: p.y }, { x, y: q.y }, q];
    } else {
      const [g1, g2] = route.gaps as [number, number];
      const x1 = colGapX(g1) + (laneOffset.get(`c${route.index}:0`) ?? 0);
      const x2 = colGapX(g2) + (laneOffset.get(`c${route.index}:1`) ?? 0);
      const y = rowGapY(route.rowGap) + (laneOffset.get(`r${route.rowGap}:${route.index}`) ?? 0);
      points = [p, { x: x1, y: p.y }, { x: x1, y }, { x: x2, y }, { x: x2, y: q.y }, q];
    }
    points = points.filter((pt, i) => i === 0 || Math.hypot(pt.x - (points[i - 1] as Point).x, pt.y - (points[i - 1] as Point).y) > 0.5);

    // Rounded corners: stop short of each turn and curve through it. A jog too small for two corners is drawn
    // as one smooth lane change instead.
    let path = `M ${p.x} ${p.y}`;
    const [, j1, j2] = points as [Point, Point | undefined, Point | undefined, Point | undefined];
    const jog = points.length === 4 && j1 && j2 ? Math.hypot(j2.x - j1.x, j2.y - j1.y) : Infinity;
    if (j1 && j2 && jog < 16) {
      const along = j1.x === j2.x ? "x" : "y";
      const sign = Math.sign(along === "x" ? q.x - p.x : q.y - p.y) || 1;
      const reach = Math.min(12, Math.abs(along === "x" ? j1.x - p.x : j1.y - p.y), Math.abs(along === "x" ? q.x - j2.x : q.y - j2.y));
      const shift = (pt: Point, d: number) => (along === "x" ? { x: pt.x + d, y: pt.y } : { x: pt.x, y: pt.y + d });
      const a = shift(j1, -sign * reach);
      const b = shift(j2, sign * reach);
      path += ` L ${a.x} ${a.y} C ${j1.x} ${j1.y} ${j2.x} ${j2.y} ${b.x} ${b.y}`;
      points = [p, a, b, q];
    }
    for (let i = 1; jog >= 16 && i < points.length - 1; i++) {
      const prev = points[i - 1] as Point;
      const at = points[i] as Point;
      const next = points[i + 1] as Point;
      const inLen = Math.hypot(at.x - prev.x, at.y - prev.y);
      const outLen = Math.hypot(next.x - at.x, next.y - at.y);
      const r = Math.min(CORNER, inLen / 2, outLen / 2);
      const before = { x: at.x - ((at.x - prev.x) / inLen) * r, y: at.y - ((at.y - prev.y) / inLen) * r };
      const after = { x: at.x + ((next.x - at.x) / outLen) * r, y: at.y + ((next.y - at.y) / outLen) * r };
      path += ` L ${before.x} ${before.y} Q ${at.x} ${at.y} ${after.x} ${after.y}`;
    }
    path += ` L ${q.x} ${q.y}`;

    const segments = points.slice(1).map((end, i) => ({ start: points[i] as Point, end }));
    const longest = [...segments].sort(
      (s, t) => Math.hypot(t.end.x - t.start.x, t.end.y - t.start.y) - Math.hypot(s.end.x - s.start.x, s.end.y - s.start.y),
    );
    const spots = longest
      .filter((seg) => Math.hypot(seg.end.x - seg.start.x, seg.end.y - seg.start.y) > 26)
      .flatMap((seg) =>
        [0.5, 0.32, 0.68, 0.18, 0.82].map((t) => ({ x: seg.start.x + (seg.end.x - seg.start.x) * t, y: seg.start.y + (seg.end.y - seg.start.y) * t })),
      );
    const first = longest[0] ?? { start: p, end: q };
    const mid = { x: (first.start.x + first.end.x) / 2, y: (first.start.y + first.end.y) / 2 };
    const xs = points.map((pt) => pt.x);
    const ys = points.map((pt) => pt.y);
    return {
      flow: route.flow,
      path,
      mid,
      number: route.index + 1,
      extent: { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) },
      spots: spots.length > 0 ? spots : [mid],
      points,
    };
  });
}

/** Clients are rounder than the other parts. */
function cornerRadius(kind: ComponentKind): number {
  return kind === "client" ? 16 : 6;
}

function ComponentShape({
  kind,
  highlighted,
  failed,
  proposed,
  tone,
}: {
  kind: ComponentKind;
  highlighted: boolean;
  failed: boolean;
  proposed: boolean;
  /** Load on it: running hot, or past what it can handle. */
  tone?: "hot" | "over";
}) {
  // Outlined in the ink itself, like a part drawn on the sheet.
  const stroke = failed
    ? "var(--mark-gap)"
    : highlighted
      ? "var(--ink)"
      : tone === "over"
        ? "var(--mark-gap)"
        : tone === "hot"
          ? "var(--mark-partial)"
          : proposed
            ? "var(--mark-ai)"
            : "color-mix(in srgb, var(--ink) 32%, transparent)";
  const x = -BOX_W / 2;
  const y = -BOX_H / 2;
  const common = {
    x,
    y,
    width: BOX_W,
    height: BOX_H,
    rx: cornerRadius(kind),
    fill: failed
      ? "var(--signal-gap-soft)"
      : highlighted
        ? "var(--highlight)"
        : proposed
          ? "var(--ai-soft)"
          : "var(--raised)",
    stroke,
    strokeWidth: highlighted || failed || tone ? 1.5 : proposed ? 1.2 : 1,
    strokeDasharray: proposed && !highlighted && !failed ? "4 3" : undefined,
  };
  switch (kind) {
    case "database":
    case "object-store":
    case "cache":
      return (
        <>
          <rect {...common} />
          <line x1={x} x2={x + BOX_W} y1={y + 9} y2={y + 9} stroke={stroke} strokeWidth={0.8} />
        </>
      );
    case "queue":
    case "stream":
      return (
        <>
          <rect {...common} />
          {[10, 16, 22].map((dx) => (
            <line
              key={dx}
              x1={x + BOX_W - dx}
              x2={x + BOX_W - dx}
              y1={y + 8}
              y2={y + 18}
              stroke={stroke}
              strokeWidth={1}
            />
          ))}
        </>
      );
    case "external":
      return <rect {...common} strokeDasharray="4 3" />;
    default:
      return <rect {...common} />;
  }
}

export type SystemMapProps = {
  components: PlacedComponent[];
  flows: ArchitectureFlow[];
  /** Ids to draw; defaults to everything. */
  visibleComponents?: string[];
  visibleFlows?: string[];
  /** Ids to emphasise, e.g. what the current stage just added. */
  highlightComponents?: string[];
  highlightFlows?: string[];
  /** Component ids to emphasise on top of highlightComponents, e.g. the parts a review finding points at. */
  highlight?: string[];
  /** Ids drawn as down: a failure the reader is about to reason through. */
  failedComponents?: string[];
  /** Ids proposed by AI: drawn dashed in the AI colour. */
  proposedComponents?: string[];
  proposedFlows?: string[];
  /** Map only, without the flow key and legend. */
  compact?: boolean;
  /** Drawn straight onto the page with no frame, scaled to fit rather than scrolled. */
  bare?: boolean;
  /** A note pinned to one component by a leader line, drawn under the map on wide screens. */
  callout?: { componentId: string; content: ReactNode };
  /**
   * A dashed lead from this component up out of the map, on wide screens, to something placed above it.
   * It runs past the map's top edge by `--lead-above` (a CSS length set by the page).
   */
  leadUpFrom?: string;
  /** The system running: requests travel along its flows, and failed parts throw red light. */
  live?: boolean;
  /** Requests per second on each flow; with `live`, only flows carrying something move, faster when busier. */
  flowLoads?: Record<string, number>;
  /** A line under a part, how hot it runs, and how many copies of it run. */
  annotations?: Record<string, { text?: string; tone?: "hot" | "over"; stack?: number; utilization?: number }>;
  /** Controlled selection, for pages that show their own details. */
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  /** Leave out the details panel under the map. */
  hideDetails?: boolean;
  label: string;
};

export function SystemMap({
  components,
  flows,
  visibleComponents,
  visibleFlows,
  highlightComponents = [],
  highlightFlows = [],
  highlight = [],
  failedComponents = [],
  proposedComponents = [],
  proposedFlows = [],
  compact = false,
  bare = false,
  callout,
  leadUpFrom,
  live = false,
  flowLoads,
  annotations,
  selectedId,
  onSelect,
  hideDetails = false,
  label,
}: SystemMapProps) {
  const [ownSelected, setOwnSelected] = useState<string | null>(null);
  const selected = onSelect ? (selectedId ?? null) : ownSelected;
  const setSelected = (id: string | null) => (onSelect ? onSelect(id) : setOwnSelected(id));
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const ids = {
    arrow: `arrow-${uid}`,
    arrowActive: `arrow-active-${uid}`,
    arrowAi: `arrow-ai-${uid}`,
    hatch: `hatch-${uid}`,
    raise: `raise-${uid}`,
    bloom: `bloom-${uid}`,
    sheen: `sheen-${uid}`,
    glow: `glow-${uid}`,
    halo: `halo-${uid}`,
  };

  const shownComponents = visibleComponents ? components.filter((c) => visibleComponents.includes(c.id)) : components;
  const shownFlows = (visibleFlows ? flows.filter((f) => visibleFlows.includes(f.id)) : flows).filter(
    (f) => shownComponents.some((c) => c.id === f.from) && shownComponents.some((c) => c.id === f.to),
  );

  // Bounds come from every component, so the map does not jump as parts appear.
  // A compact map shows one moment, so it is cropped to what is on it.
  const framed = compact && shownComponents.length > 0 ? shownComponents : components;
  const cols = framed.map((c) => c.position.col);
  const rows = framed.map((c) => c.position.row);
  const origin = { col: Math.min(...cols), row: Math.min(...rows) };
  const width = (Math.max(...cols) - origin.col + 1) * CELL_W + PAD * 2;
  const height = (Math.max(...rows) - origin.row + 1) * CELL_H + PAD * 2;

  const byId = new Map(shownComponents.map((c) => [c.id, c]));
  const geometry = separateBadges(flowGeometry(shownFlows, byId, origin));
  const selectedComponent = selected ? byId.get(selected) : undefined;
  const selectedFlowIds = new Set(
    selected ? shownFlows.filter((f) => f.from === selected || f.to === selected).map((f) => f.id) : [],
  );
  const highlightC = new Set([...highlightComponents, ...highlight]);
  const highlightF = new Set(highlightFlows);
  const failedC = new Set(failedComponents);
  const proposedC = new Set(proposedComponents);
  const proposedF = new Set(proposedFlows);
  const usedKinds = [...new Set(shownFlows.map((f) => f.kind))];
  const nameOf = (id: string) => byId.get(id)?.label ?? id;
  // Lines routed round the outside of the grid may leave it; grow the canvas to fit them.
  const top = Math.min(0, ...geometry.map((g) => g.extent.minY - 14));
  const bottom = Math.max(height, ...geometry.map((g) => g.extent.maxY + 14));
  const left = Math.min(0, ...geometry.map((g) => g.extent.minX - 14));
  const right = Math.max(width, ...geometry.map((g) => g.extent.maxX + 14));
  const pinned = callout ? byId.get(callout.componentId) : undefined;
  const pin = pinned ? center(pinned, origin) : null;
  // On wide screens the callout is pulled up beside the diagram's lower rows, joined to its part by a short lead.
  const leadEnd = pin ? Math.min(pin.y + BOX_H / 2 + 34, bottom) : 0;
  const pull = pin ? ((bottom - leadEnd) / (right - left)) * 100 : 0;
  const leadComponent = leadUpFrom ? byId.get(leadUpFrom) : undefined;
  // The lead lands left of the part's centre, clear of the badge on any flow running straight through above it.
  const leadCenter = leadComponent ? center(leadComponent, origin) : null;
  const lead = leadCenter ? { x: leadCenter.x - BOX_W * 0.3, y: leadCenter.y } : null;
  const deadFlow = (f: ArchitectureFlow) => failedC.has(f.from) || failedC.has(f.to);

  return (
    <figure>
      <div className={bare ? "relative" : "screen overflow-x-auto p-3 sm:p-5"}>
        {lead && (
          <span
            aria-hidden="true"
            className="absolute bottom-full hidden h-[var(--lead-above,0px)] border-l-[1.5px] border-dashed border-mark-gap/70 lg:block"
            style={{ left: `${(((lead.x - left) / (right - left)) * 100).toFixed(2)}%` }}
          />
        )}
        <svg
          viewBox={`${left} ${top} ${right - left} ${bottom - top}`}
          className={`h-auto w-full select-none ${bare ? "" : "min-w-[540px]"}`}
          role="group"
          aria-label={label}
        >
          <defs>
            <marker
              id={ids.arrow}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="9"
              markerHeight="9"
              markerUnits="userSpaceOnUse"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 9 5 L 0 9 z" fill="var(--ink-3)" />
            </marker>
            <marker
              id={ids.arrowActive}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="9"
              markerHeight="9"
              markerUnits="userSpaceOnUse"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 9 5 L 0 9 z" fill="var(--ink)" />
            </marker>
            <marker
              id={ids.arrowAi}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="9"
              markerHeight="9"
              markerUnits="userSpaceOnUse"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 9 5 L 0 9 z" fill="var(--mark-ai)" />
            </marker>
            <pattern id={ids.hatch} width={6} height={6} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1={0} y1={0} x2={0} y2={6} stroke="var(--mark-gap)" strokeOpacity={0.3} strokeWidth={1} />
            </pattern>
            <linearGradient id={ids.sheen} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fff" stopOpacity={0.07} />
              <stop offset="45%" stopColor="#fff" stopOpacity={0} />
            </linearGradient>
            <filter id={ids.glow} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.4" />
            </filter>
            <filter id={ids.halo} x="-40%" y="-60%" width="180%" height="220%">
              <feGaussianBlur stdDeviation="9" />
            </filter>
            <radialGradient id={ids.bloom}>
              <stop offset="0%" stopColor="var(--mark-gap)" stopOpacity={0.16} />
              <stop offset="45%" stopColor="var(--mark-gap)" stopOpacity={0.05} />
              <stop offset="100%" stopColor="var(--mark-gap)" stopOpacity={0} />
            </radialGradient>
            {/* Components are keys resting on the paper: a tight contact shadow and a soft fall-off below. */}
            <filter id={ids.raise} x="-25%" y="-35%" width="150%" height="190%">
              <feDropShadow dx="0" dy="1" stdDeviation="0.75" floodColor="var(--drop-1)" floodOpacity="1" />
              <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="var(--drop-2)" floodOpacity="1" />
            </filter>
          </defs>
          {live &&
            shownComponents
              .filter((c) => failedC.has(c.id))
              .map((c) => {
                const p = center(c, origin);
                return <ellipse key={c.id} cx={p.x} cy={p.y + 10} rx={230} ry={170} fill={`url(#${ids.bloom})`} />;
              })}
          {lead && (
            <line
              x1={lead.x}
              y1={lead.y - BOX_H / 2 - 2}
              x2={lead.x}
              y2={top}
              stroke="var(--mark-gap)"
              strokeOpacity={0.7}
              strokeWidth={1.5}
              strokeDasharray="3 3"
              className="max-lg:hidden"
            />
          )}
          {pin && (
            <line
              x1={pin.x}
              y1={pin.y + BOX_H / 2 + 3}
              x2={pin.x}
              y2={leadEnd}
              stroke="var(--mark-gap)"
              strokeWidth={1.5}
              strokeDasharray="3 3"
              className="max-lg:hidden"
            />
          )}
          {geometry.map(({ flow, path }) => {
            const style = FLOW_STYLE[flow.kind];
            const active = selectedFlowIds.has(flow.id) || (!selected && highlightF.has(flow.id));
            const proposed = proposedF.has(flow.id);
            const dimmed = !onSelect && selected !== null && !selectedFlowIds.has(flow.id);
            const dead = !active && deadFlow(flow);
            // Live, a flow is a quiet track; the traffic on it is drawn as light on top.
            const track = live && !active && !proposed && !dead;
            return (
              <path
                key={flow.id}
                d={path}
                fill="none"
                stroke={active ? "var(--ink)" : proposed ? "var(--mark-ai)" : dead ? "var(--mark-gap)" : "var(--ink-3)"}
                strokeOpacity={dimmed ? 0.25 : dead ? 0.6 : track ? 0.38 : flow.kind === "data" && !active ? 0.55 : 1}
                strokeWidth={active ? Math.max(style.width, 1.6) : style.width}
                strokeDasharray={proposed || dead ? "4 3" : style.dash}
                markerEnd={`url(#${active ? ids.arrowActive : proposed ? ids.arrowAi : ids.arrow})`}
              />
            );
          })}
          {live &&
            geometry
              .filter(({ flow }) => !deadFlow(flow) && (!flowLoads || (flowLoads[flow.id] ?? 0) > 0))
              .map(({ flow, path }, i) => {
                // Traffic as streaks of light: busier flows carry more of them, wider and faster.
                const rate = flowLoads?.[flow.id] ?? [40, 900, 12_000][i % 3] ?? 100;
                const level = Math.log10(rate + 1);
                // Roughly how long the flow is on screen, end to end: short flows carry one streak.
                const points = (path.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
                const reach = Math.hypot(
                  (points[points.length - 2] ?? 0) - (points[0] ?? 0),
                  (points[points.length - 1] ?? 0) - (points[1] ?? 0),
                );
                const comets = reach < 140 ? 1 : Math.min(reach < 280 ? 2 : 3, rate < 100 ? 1 : rate < 10_000 ? 2 : 3);
                const period = 100 / comets;
                const tail = Math.min(reach < 140 ? 38 : 18, period * 0.55);
                const head = 2.4;
                const width = 1.1 + 0.32 * level;
                const seconds = Math.min(4, Math.max(1.1, 4.2 - 0.48 * level)) * (comets / 2 + 0.5);
                const timing = {
                  "--period": period,
                  animationDuration: `${seconds.toFixed(2)}s`,
                  animationDelay: `${(-(i * 0.37) % seconds).toFixed(2)}s`,
                } as CSSProperties;
                return (
                  <g key={flow.id} aria-hidden="true" className="current">
                    <path
                      d={path}
                      pathLength={100}
                      fill="none"
                      stroke="var(--accent-solid)"
                      strokeOpacity={0.45}
                      strokeWidth={width + 3}
                      strokeLinecap="round"
                      strokeDasharray={`${tail} ${period - tail}`}
                      filter={`url(#${ids.glow})`}
                      className="current-dash"
                      style={{ ...timing, "--shift": 0 } as CSSProperties}
                    />
                    <path
                      d={path}
                      pathLength={100}
                      fill="none"
                      stroke="var(--accent-solid)"
                      strokeOpacity={0.35}
                      strokeWidth={width}
                      strokeLinecap="round"
                      strokeDasharray={`${tail} ${period - tail}`}
                      className="current-dash"
                      style={{ ...timing, "--shift": 0 } as CSSProperties}
                    />
                    <path
                      d={path}
                      pathLength={100}
                      fill="none"
                      stroke="color-mix(in srgb, var(--accent-solid) 55%, white)"
                      strokeWidth={width + 0.5}
                      strokeLinecap="round"
                      strokeDasharray={`${head} ${period - head}`}
                      className="current-dash"
                      style={{ ...timing, "--shift": -(tail - head) } as CSSProperties}
                    />
                  </g>
                );
              })}
          {!live &&
            geometry.map(({ flow, mid, number }) => {
              const active = selectedFlowIds.has(flow.id) || (!selected && highlightF.has(flow.id));
              const proposed = proposedF.has(flow.id);
              const dimmed = !onSelect && selected !== null && !selectedFlowIds.has(flow.id);
              return (
                <g key={flow.id} transform={`translate(${mid.x} ${mid.y})`} opacity={dimmed ? 0.3 : 1}>
                  <circle
                    r={8.5}
                    fill={active ? "var(--highlight)" : proposed ? "var(--ai-soft)" : "var(--raised)"}
                    stroke={active ? "var(--ink)" : proposed ? "var(--mark-ai)" : "var(--rule-strong)"}
                    strokeWidth={0.8}
                  />
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={8.5}
                    fontFamily="var(--font-mono)"
                    fill={active ? "var(--ink)" : proposed ? "var(--ai)" : "var(--ink-2)"}
                  >
                    {number}
                  </text>
                </g>
              );
            })}
          {shownComponents.map((c) => {
            const p = center(c, origin);
            const isSelected = selected === c.id;
            const failed = failedC.has(c.id);
            const proposed = proposedC.has(c.id);
            const highlighted = isSelected || (!selected && highlightC.has(c.id));
            // Pages that show their own details keep the whole map readable while a part is selected.
            const dimmed =
              !onSelect &&
              selected !== null &&
              !isSelected &&
              !shownFlows.some((f) => selectedFlowIds.has(f.id) && (f.from === c.id || f.to === c.id));
            const lines = splitLabel(c.label);
            const note = annotations?.[c.id];
            const stack = Math.min(3, note?.stack ?? 1);
            return (
              <g
                key={c.id}
                transform={`translate(${p.x} ${p.y})`}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                aria-label={`${c.label}, ${KIND_LABEL[c.kind]}${failed ? ", down" : ""}${proposed ? ", proposed" : ""}`}
                className="cursor-pointer outline-none focus-visible:[&_rect]:stroke-[var(--focus)]"
                opacity={dimmed ? 0.4 : 1}
                onClick={() => setSelected(isSelected ? null : c.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected(isSelected ? null : c.id);
                  }
                }}
              >
                {/* Live, a part under strain glows: amber when hot, a slow red pulse past capacity or down. */}
                {live && (note?.tone || failed) && (
                  <rect
                    x={-BOX_W / 2 + 4}
                    y={-BOX_H / 2 + 6}
                    width={BOX_W - 8}
                    height={BOX_H - 6}
                    rx={cornerRadius(c.kind)}
                    fill={note?.tone === "hot" && !failed ? "var(--mark-partial)" : "var(--mark-gap)"}
                    opacity={note?.tone === "hot" && !failed ? 0.32 : 0.45}
                    filter={`url(#${ids.halo})`}
                    className={note?.tone === "over" || failed ? "halo-pulse" : undefined}
                    aria-hidden="true"
                  />
                )}
                <g filter={`url(#${ids.raise})`}>
                  {/* More than one copy running: the others show as cards stacked behind. */}
                  {Array.from({ length: stack - 1 }, (_, i) => stack - 1 - i).map((depth) => (
                    <rect
                      key={depth}
                      x={-BOX_W / 2 + depth * 5}
                      y={-BOX_H / 2 - depth * 5}
                      width={BOX_W}
                      height={BOX_H}
                      rx={cornerRadius(c.kind)}
                      fill="var(--raised)"
                      stroke="color-mix(in srgb, var(--ink) 14%, transparent)"
                      strokeWidth={1}
                    />
                  ))}
                  <ComponentShape
                    kind={c.kind}
                    highlighted={highlighted}
                    failed={failed}
                    proposed={proposed}
                    tone={note?.tone}
                  />
                  {live && (
                    <rect
                      x={-BOX_W / 2}
                      y={-BOX_H / 2}
                      width={BOX_W}
                      height={BOX_H}
                      rx={cornerRadius(c.kind)}
                      fill={`url(#${ids.sheen})`}
                      aria-hidden="true"
                    />
                  )}
                  {failed && (
                    <rect
                      x={-BOX_W / 2}
                      y={-BOX_H / 2}
                      width={BOX_W}
                      height={BOX_H}
                      rx={cornerRadius(c.kind)}
                      fill={`url(#${ids.hatch})`}
                    />
                  )}
                </g>
                {/* How busy it is: a thin gauge set into the card's lower edge. */}
                {note?.utilization !== undefined && !failed && (
                  <g aria-hidden="true">
                    <line
                      x1={-BOX_W / 2 + 12}
                      x2={BOX_W / 2 - 12}
                      y1={BOX_H / 2 - 6}
                      y2={BOX_H / 2 - 6}
                      stroke="color-mix(in srgb, var(--ink) 12%, transparent)"
                      strokeWidth={2}
                      strokeLinecap="round"
                    />
                    <line
                      x1={-BOX_W / 2 + 12}
                      x2={-BOX_W / 2 + 12 + (BOX_W - 24) * Math.min(1, Math.max(0.02, note.utilization))}
                      y1={BOX_H / 2 - 6}
                      y2={BOX_H / 2 - 6}
                      stroke={
                        note.tone === "over"
                          ? "var(--mark-gap)"
                          : note.tone === "hot"
                            ? "var(--mark-partial)"
                            : "var(--accent-solid)"
                      }
                      strokeWidth={2}
                      strokeLinecap="round"
                    />
                  </g>
                )}
                {failed && (
                  <circle
                    cx={BOX_W / 2 - 10}
                    cy={-BOX_H / 2 + 10}
                    r={3.5}
                    fill="var(--mark-gap)"
                    className="led-pulse"
                  />
                )}
                <text
                  y={lines.length === 1 ? -7 : -14}
                  textAnchor="middle"
                  fontSize={compact ? 9 : 8}
                  fontFamily="var(--font-mono)"
                  letterSpacing={0.8}
                  fill={failed ? "var(--signal-gap)" : highlighted ? "var(--ink-2)" : "var(--ink-3)"}
                >
                  {proposed && <tspan fill="var(--ai)">PROPOSED · </tspan>}
                  {(failed ? `${KIND_LABEL[c.kind]} · down` : KIND_LABEL[c.kind]).toUpperCase()}
                </text>
                {lines.map((line, i) => (
                  <text
                    key={i}
                    y={(lines.length === 1 ? 10 : 4) + i * (compact ? 15 : 14)}
                    textAnchor="middle"
                    fontSize={compact ? 14 : 12.5}
                    fontWeight={500}
                    fill="var(--ink)"
                  >
                    {line}
                  </text>
                ))}
                {note?.text && (
                  // A pill on the top-right corner, where flows do not attach.
                  <g transform={`translate(${BOX_W / 2 + 6} ${-BOX_H / 2})`} aria-hidden="true">
                    <rect
                      x={-(note.text.length * 5.5 + 12)}
                      y={-8}
                      width={note.text.length * 5.5 + 12}
                      height={16}
                      rx={8}
                      fill="var(--raised)"
                      stroke={
                        failed || note.tone === "over"
                          ? "var(--mark-gap)"
                          : note.tone === "hot"
                            ? "var(--mark-partial)"
                            : "color-mix(in srgb, var(--ink) 18%, transparent)"
                      }
                      strokeWidth={1}
                    />
                    <text
                      x={-6}
                      y={3.2}
                      textAnchor="end"
                      fontSize={9}
                      fontFamily="var(--font-mono)"
                      fill={
                        failed || note.tone === "over"
                          ? "var(--signal-gap)"
                          : note.tone === "hot"
                            ? "var(--signal-partial)"
                            : "var(--ink-2)"
                      }
                    >
                      {note.text}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      {pin && callout && (
        <div
          className="relative lg:mt-[var(--pull)] lg:ml-[calc(var(--pin)-1.5rem)] lg:w-[min(26rem,calc(100%-var(--pin)+1.5rem))]"
          style={
            {
              "--pin": `${(((pin.x - left) / (right - left)) * 100).toFixed(2)}%`,
              "--pull": `-${pull.toFixed(2)}%`,
            } as CSSProperties
          }
        >
          {callout.content}
        </div>
      )}
      <figcaption className={hideDetails || (compact && !selectedComponent) ? "sr-only" : "mt-3 space-y-3"}>
        {selectedComponent ? (
          <div className="panel p-4 text-[0.8125rem]">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-medium">{selectedComponent.label}</p>
              <button
                type="button"
                className="text-ink-3 hover:text-ink text-xs font-medium"
                onClick={() => setSelected(null)}
              >
                Clear
              </button>
            </div>
            <p className="mt-1 text-ink-2">{selectedComponent.responsibility}</p>
            {selectedComponent.durableState && (
              <p className="mt-2 text-ink-2">
                <span className="eyebrow mr-2">Durable state</span>
                {selectedComponent.durableState}
              </p>
            )}
          </div>
        ) : compact ? null : (
          <p className="text-xs text-ink-3">
            Select a component to see what it is responsible for and which state it owns.
          </p>
        )}
        {!compact && geometry.length > 0 && (
          <ol className="gap-x-6 text-[0.8125rem] sm:columns-2 [&>li]:break-inside-avoid [&>li]:py-0.5">
            {geometry.map(({ flow, number }) => {
              const dimmed = !onSelect && selected !== null && !selectedFlowIds.has(flow.id);
              return (
                <li key={flow.id} className={`flex gap-2 ${dimmed ? "opacity-40" : ""}`}>
                  <span className="w-4 shrink-0 text-right font-mono text-[0.6875rem] tabular-nums text-ink-3">
                    {number}
                  </span>
                  <span className="text-ink-2">
                    <span className="text-ink">
                      {nameOf(flow.from)} → {nameOf(flow.to)}
                    </span>
                    : {flow.label}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
        {!compact && usedKinds.length > 1 && (
          <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-3" aria-label="Line styles">
            {usedKinds.map((kind) => (
              <li key={kind} className="flex items-center gap-2">
                <FlowLine kind={kind} width={26} />
                {FLOW_STYLE[kind].label}
              </li>
            ))}
          </ul>
        )}
      </figcaption>
    </figure>
  );
}
