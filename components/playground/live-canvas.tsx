"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ROLES, databaseState, type PlayComponent, type PlayModel, type Role, type Simulation } from "@/lib/domain/playground";
import { formatRate, percent } from "@/lib/domain/playground-insights";

export type LiveCanvasProps = {
  model: PlayModel;
  sim: Simulation;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Parts to draw attention to (a tour step, a hint): a soft pulsing ember ring. */
  highlight?: string[];
  label: string;
  className?: string;
  /**
   * Fill the parent and fit the system inside it, leaving these insets (px) free for panels floating over the
   * canvas. Without it the canvas is as tall as the system and scales to the width.
   */
  fill?: { top: number; right: number; bottom: number; left: number };
};

// Geometry at scale 1. A cell holds one card and the gutters its edges and rate labels run through.
const CELL_W = 260;
const CELL_H = 132;
const CARD_W = 176;
const CARD_H = 86;
const PAD = 28;
const GAP_X = CELL_W - CARD_W;
const GAP_Y = CELL_H - CARD_H;
const MIN_SCALE = 0.62;
const RADIUS = 9;

type Box = { x: number; y: number; col: number; row: number };
type Point = { x: number; y: number };

const ROLE_LABEL: Record<Role, string> = {
  client: "client",
  lb: "load balancer",
  cdn: "cdn",
  limiter: "rate limiter",
  service: "service",
  worker: "worker",
  database: "database",
  cache: "cache",
  queue: "queue",
  "object-store": "object store",
  external: "external",
};

/** Small stroke glyphs, one per role, drawn on a 16px grid. */
function RoleIcon({ role }: { role: Role }) {
  const paths: Record<Role, ReactNode> = {
    client: (
      <>
        <rect x="2.5" y="3" width="11" height="7.5" rx="1.5" />
        <path d="M6 13h4M8 10.5V13" />
      </>
    ),
    lb: (
      <>
        <circle cx="8" cy="3.5" r="1.5" />
        <circle cx="3.5" cy="12.5" r="1.5" />
        <circle cx="12.5" cy="12.5" r="1.5" />
        <path d="M8 5v2.5M8 7.5 3.5 11M8 7.5l4.5 3.5" />
      </>
    ),
    cdn: (
      <>
        <circle cx="8" cy="8" r="5.5" />
        <path d="M2.5 8h11M8 2.5c-2 2.2-2 8.8 0 11M8 2.5c2 2.2 2 8.8 0 11" />
      </>
    ),
    limiter: <path d="M2.5 3h11l-4.25 5v4.5l-2.5 1V8z" />,
    service: (
      <>
        <rect x="2.5" y="2.5" width="11" height="4.5" rx="1.2" />
        <rect x="2.5" y="9" width="11" height="4.5" rx="1.2" />
        <path d="M5 4.75h.01M5 11.25h.01" />
      </>
    ),
    worker: (
      <>
        <circle cx="8" cy="8" r="2.25" />
        <path d="M8 2v2M8 12v2M2 8h2M12 8h2M3.8 3.8l1.4 1.4M10.8 10.8l1.4 1.4M3.8 12.2l1.4-1.4M10.8 5.2l1.4-1.4" />
      </>
    ),
    database: (
      <>
        <ellipse cx="8" cy="4" rx="5" ry="1.75" />
        <path d="M3 4v8c0 1 2.2 1.75 5 1.75s5-.75 5-1.75V4M3 8c0 1 2.2 1.75 5 1.75S13 9 13 8" />
      </>
    ),
    cache: <path d="M9 2 4 9h3.5L7 14l5-7H8.5z" />,
    queue: <path d="M3 4h10M3 8h10M3 12h10" />,
    "object-store": (
      <>
        <path d="M2.5 5 8 2.5 13.5 5v6L8 13.5 2.5 11z" />
        <path d="M2.5 5 8 7.5 13.5 5M8 7.5v6" />
      </>
    ),
    external: <path d="M6 2.5v3M10 2.5v3M4 5.5h8v2.5a4 4 0 0 1-8 0zM8 12v1.5" />,
  };
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      {paths[role]}
    </svg>
  );
}

/** A polyline with its corners rounded. */
function roundedPath(points: Point[], r = RADIUS): string {
  const clean: Point[] = [];
  for (const p of points) {
    const last = clean[clean.length - 1];
    if (!last || Math.abs(p.x - last.x) > 0.5 || Math.abs(p.y - last.y) > 0.5) clean.push(p);
  }
  const first = clean[0];
  const end = clean[clean.length - 1];
  if (!first || !end || clean.length < 2) return "";
  let d = `M${first.x},${first.y}`;
  clean.forEach((at, i) => {
    const prev = clean[i - 1];
    const next = clean[i + 1];
    if (!prev || !next) return;
    const inLen = Math.hypot(at.x - prev.x, at.y - prev.y);
    const outLen = Math.hypot(next.x - at.x, next.y - at.y);
    const k = Math.min(r, inLen / 2, outLen / 2);
    const a = { x: at.x - ((at.x - prev.x) / inLen) * k, y: at.y - ((at.y - prev.y) / inLen) * k };
    const b = { x: at.x + ((next.x - at.x) / outLen) * k, y: at.y + ((next.y - at.y) / outLen) * k };
    d += ` L${a.x},${a.y} Q${at.x},${at.y} ${b.x},${b.y}`;
  });
  return `${d} L${end.x},${end.y}`;
}

/** The point halfway along a polyline, where the rate label sits. */
function midpointOf(points: Point[]): Point {
  const segments = points.slice(1).map((p, i) => {
    const from = points[i] ?? p;
    return { from, to: p, length: Math.hypot(p.x - from.x, p.y - from.y) };
  });
  let half = segments.reduce((sum, seg) => sum + seg.length, 0) / 2;
  for (const seg of segments) {
    if (half <= seg.length) {
      const t = seg.length === 0 ? 0 : half / seg.length;
      return { x: seg.from.x + (seg.to.x - seg.from.x) * t, y: seg.from.y + (seg.to.y - seg.from.y) * t };
    }
    half -= seg.length;
  }
  return points[points.length - 1] ?? { x: 0, y: 0 };
}

/**
 * Orthogonal route from one card to another. Cards in later columns are reached from the right edge, earlier
 * ones from the left, and cards in the same column from top or bottom. A route that would pass behind another
 * card goes round it through the gutters instead.
 */
function routeOf(from: Box, to: Box, occupied: Set<string>, offset: number): Point[] {
  const cy1 = from.y + CARD_H / 2 + offset;
  const cy2 = to.y + CARD_H / 2 + offset;
  const blockedRow = (row: number, c1: number, c2: number) => {
    for (let c = Math.min(c1, c2) + 1; c < Math.max(c1, c2); c++) if (occupied.has(`${c}:${row}`)) return true;
    return false;
  };

  if (from.col === to.col) {
    const cx = from.x + CARD_W / 2 + offset;
    const down = to.row > from.row;
    const blocked = (() => {
      for (let r = Math.min(from.row, to.row) + 1; r < Math.max(from.row, to.row); r++)
        if (occupied.has(`${from.col}:${r}`)) return true;
      return false;
    })();
    if (!blocked) {
      return [
        { x: cx, y: down ? from.y + CARD_H : from.y },
        { x: cx, y: down ? to.y : to.y + CARD_H },
      ];
    }
    // Round the right-hand side of the column.
    const gx = from.x + CARD_W + GAP_X / 2;
    return [
      { x: from.x + CARD_W, y: cy1 },
      { x: gx, y: cy1 },
      { x: gx, y: cy2 },
      { x: to.x + CARD_W, y: cy2 },
    ];
  }

  const right = to.col > from.col;
  const x1 = right ? from.x + CARD_W : from.x;
  const x2 = right ? to.x : to.x + CARD_W;
  const dir = right ? 1 : -1;

  if (from.row === to.row) {
    if (!blockedRow(from.row, from.col, to.col)) return [{ x: x1, y: cy1 }, { x: x2, y: cy2 }];
    // Up into the gutter above the row, along it, and back down.
    const gy = from.y - GAP_Y / 2;
    return [
      { x: x1, y: cy1 },
      { x: x1 + (dir * GAP_X) / 2, y: cy1 },
      { x: x1 + (dir * GAP_X) / 2, y: gy },
      { x: x2 - (dir * GAP_X) / 2, y: gy },
      { x: x2 - (dir * GAP_X) / 2, y: cy2 },
      { x: x2, y: cy2 },
    ];
  }

  // Different row and column: one vertical run, in the gutter beside the target if the source's row is clear,
  // else beside the source if the target's row is clear, else through the gutter between the rows.
  const nearTarget = x2 - (dir * GAP_X) / 2;
  const nearSource = x1 + (dir * GAP_X) / 2;
  if (!blockedRow(from.row, from.col, to.col + dir)) {
    return [
      { x: x1, y: cy1 },
      { x: nearTarget, y: cy1 },
      { x: nearTarget, y: cy2 },
      { x: x2, y: cy2 },
    ];
  }
  if (!blockedRow(to.row, from.col - dir, to.col)) {
    return [
      { x: x1, y: cy1 },
      { x: nearSource, y: cy1 },
      { x: nearSource, y: cy2 },
      { x: x2, y: cy2 },
    ];
  }
  const between = to.row > from.row ? from.y + CARD_H + GAP_Y / 2 : from.y - GAP_Y / 2;
  return [
    { x: x1, y: cy1 },
    { x: nearSource, y: cy1 },
    { x: nearSource, y: between },
    { x: nearTarget, y: between },
    { x: nearTarget, y: cy2 },
    { x: x2, y: cy2 },
  ];
}

/** Seconds for the dots to travel one dash period: faster as more flows. */
function dotDuration(rate: number) {
  const d = 1.5 - 0.22 * Math.log10(Math.max(1, rate));
  return Math.min(1.5, Math.max(0.35, d));
}

const STYLE = `
.lc-dots { animation: lc-flow var(--lc-d, 1s) linear infinite; }
@keyframes lc-flow { from { stroke-dashoffset: 0; } to { stroke-dashoffset: -32; } }
.lc-pulse { animation: lc-pulse 1.8s ease-in-out infinite; }
@keyframes lc-pulse {
  0%, 100% { box-shadow: 0 0 0 2px var(--accent-solid), 0 0 0 6px color-mix(in srgb, var(--accent-solid) 22%, transparent); }
  50% { box-shadow: 0 0 0 2px var(--accent-solid), 0 0 0 11px color-mix(in srgb, var(--accent-solid) 0%, transparent); }
}
.lc-card { transition: box-shadow 160ms var(--ease-out), transform 160ms var(--ease-out), background-color 160ms var(--ease-out); }
.lc-card:hover { transform: translateY(-1px); }
.lc-card:focus-visible { outline: 2px solid var(--focus); outline-offset: 3px; }
.lc-hatch {
  background-image: repeating-linear-gradient(135deg, color-mix(in srgb, var(--mark-gap) 12%, transparent) 0 4px, transparent 4px 9px);
}
.lc-grid {
  background-color: var(--well);
  background-image: radial-gradient(circle at center, var(--grid-minor) 1px, transparent 1.3px);
  background-size: 20px 20px;
  background-position: -10px -10px;
}
@media (prefers-reduced-motion: reduce) {
  .lc-dots { animation: none; opacity: 0; }
  .lc-pulse { animation: none; box-shadow: 0 0 0 2px var(--accent-solid); }
  .lc-card:hover { transform: none; }
}
`;

type CardFacts = {
  load: number;
  status: Simulation["components"][string]["status"];
  managed: boolean;
  utilization: number;
  line: { text: string; tone?: "bad" | "warn" | "good" }[];
  copies?: string;
  aria: string;
};

function factsOf(c: PlayComponent, model: PlayModel, sim: Simulation): CardFacts {
  const r = sim.components[c.id];
  const t = model.tuning[c.id];
  const managed = Boolean(ROLES[c.role].managed);
  const status = r?.status ?? "idle";
  const utilization = r?.utilization ?? 0;
  if (c.role === "client") {
    const sent = model.flows.filter((f) => f.from === c.id).reduce((sum, f) => sum + (sim.flows[f.id] ?? 0), 0);
    return {
      load: sent,
      status,
      managed: true,
      utilization: 0,
      line: [],
      aria: `${c.label}: sends ${formatRate(sent)}`,
    };
  }
  const load = (r?.reads ?? 0) + (r?.writes ?? 0);
  const line: CardFacts["line"] = [];
  line.push({ text: load > 0 ? `${formatRate(load)} in` : "idle" });
  if (status !== "down") {
    if ((r?.lost ?? 0) > 0) line.push({ text: `${percent(r?.lost ?? 0)} lost`, tone: "bad" });
    if ((r?.rejected ?? 0) > 0) line.push({ text: `${formatRate(r?.rejected ?? 0)} shed`, tone: "warn" });
    if (!managed && utilization > 1 && load > 0) {
      line.push({ text: `+${formatRate(load - load / utilization)} waiting`, tone: "bad" });
    }
    if ((c.role === "cache" || c.role === "cdn") && (r?.absorbed ?? 0) > 0 && load > 0) {
      line.push({ text: `${percent(Math.min(1, (r?.absorbed ?? 0) / load))} hits`, tone: "good" });
    }
  }
  let copies: string | undefined;
  if (t && !managed) {
    if (c.role === "database") {
      const db = databaseState(t);
      const parts = [`${db.shards}${t.instances > 1 ? ` of ${t.instances}` : ""} ${t.instances === 1 ? "primary" : "shards"}`];
      if (t.replicas > 0) parts.push(`${t.replicas} repl`);
      copies = t.instances === 1 && t.replicas === 0 && db.shards === 1 ? undefined : parts.join(" · ");
    } else {
      const alive = r?.alive ?? t.instances;
      copies = t.instances > 1 || alive !== t.instances ? `×${alive}${alive !== t.instances ? `/${t.instances}` : ""}` : undefined;
    }
  }
  const parts = [
    status === "down" ? "down" : managed ? `${formatRate(load)}, managed` : `${percent(utilization)} busy`,
    ...line.map((l) => l.text),
    copies,
    status === "over" ? "over capacity" : status === "hot" ? "running hot" : undefined,
    r?.spof ? "single point of failure" : undefined,
  ].filter(Boolean);
  return { load, status, managed, utilization, line, copies, aria: `${c.label}: ${parts.join(", ")}` };
}

export function LiveCanvas({ model, sim, selectedId, onSelect, highlight = [], label, className, fill }: LiveCanvasProps) {
  const cols = model.components.map((c) => c.position.col);
  const rows = model.components.map((c) => c.position.row);
  const minCol = Math.min(0, ...cols);
  const minRow = Math.min(0, ...rows);
  const nCols = Math.max(...cols, 0) - minCol + 1;
  const nRows = Math.max(...rows, 0) - minRow + 1;
  const width = PAD * 2 + nCols * CELL_W - GAP_X;
  const height = PAD * 2 + nRows * CELL_H - GAP_Y;

  const box = new Map<string, Box>();
  const occupied = new Set<string>();
  for (const c of model.components) {
    const col = c.position.col - minCol;
    const row = c.position.row - minRow;
    box.set(c.id, { x: PAD + col * CELL_W, y: PAD + row * CELL_H, col, row });
    occupied.add(`${col}:${row}`);
  }

  const outer = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [scroll, setScroll] = useState(false);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const fillKey = fill ? `${fill.top}|${fill.right}|${fill.bottom}|${fill.left}` : "";
  useLayoutEffect(() => {
    const el = outer.current;
    if (!el) return;
    const measure = () => {
      if (fill) {
        const w = Math.max(1, el.clientWidth - fill.left - fill.right);
        const h = Math.max(1, el.clientHeight - fill.top - fill.bottom);
        const next = Math.max(0.45, Math.min(1.12, w / width, h / height));
        setScale(next);
        setScroll(false);
        setOrigin({ x: fill.left + (w - width * next) / 2, y: fill.top + (h - height * next) / 2 });
        return;
      }
      setScale(Math.max(MIN_SCALE, Math.min(1, el.clientWidth / width)));
      setScroll(el.clientWidth < width * MIN_SCALE);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fillKey stands for fill
  }, [width, height, fillKey]);

  const statusOf = (id: string) => sim.components[id]?.status ?? "idle";
  const lit = new Set(highlight);

  // Flows between the same two parts are drawn side by side.
  const pairCount = new Map<string, number>();
  const pairIndex = new Map<string, number>();
  for (const f of model.flows) {
    const key = [f.from, f.to].sort().join("|");
    pairIndex.set(f.id, pairCount.get(key) ?? 0);
    pairCount.set(key, (pairCount.get(key) ?? 0) + 1);
  }

  const edges = model.flows.flatMap((f) => {
    const a = box.get(f.from);
    const b = box.get(f.to);
    if (!a || !b) return [];
    const key = [f.from, f.to].sort().join("|");
    const count = pairCount.get(key) ?? 1;
    const index = pairIndex.get(f.id) ?? 0;
    const offset = count > 1 ? (index - (count - 1) / 2) * 12 : 0;
    const points = routeOf(a, b, occupied, offset);
    const rate = sim.flows[f.id] ?? 0;
    const dead = statusOf(f.from) === "down" || statusOf(f.to) === "down";
    const strained = !dead && statusOf(f.to) === "over" && rate > 0;
    return [{ flow: f, d: roundedPath(points), mid: midpointOf(points), rate, dead, strained }];
  });

  const markerId = `lc-arrow-${label.replace(/[^a-z0-9]/gi, "").slice(0, 24)}`;

  return (
    <figure
      aria-label={label}
      className={`relative m-0 overflow-hidden ${fill ? "h-full" : "rounded-[14px] lc-grid shadow-[var(--shadow-well)]"} ${className ?? ""}`}
    >
      <style>{STYLE}</style>
      <div
        ref={outer}
        className={fill ? "absolute inset-0" : scroll ? "overflow-x-auto" : "overflow-hidden"}
        onClick={() => onSelect(null)}
      >
        <div
          style={fill ? undefined : { width: width * scale, height: height * scale }}
          className={fill ? "absolute inset-0" : "relative mx-auto"}
        >
          <div
            className={`absolute top-0 left-0 origin-top-left ${fill ? "transition-transform duration-300 ease-[var(--ease-out)]" : ""}`}
            style={{
              width,
              height,
              transform: fill
                ? `translate(${origin.x}px, ${origin.y}px) scale(${scale})`
                : `scale(${scale})`,
            }}
          >
            <svg width={width} height={height} className="absolute inset-0 overflow-visible" aria-hidden="true">
              <defs>
                {(["base", "bad", "dead"] as const).map((tone) => (
                  <marker
                    key={tone}
                    id={`${markerId}-${tone}`}
                    viewBox="0 0 8 8"
                    refX="7"
                    refY="4"
                    markerWidth="7"
                    markerHeight="7"
                    orient="auto-start-reverse"
                  >
                    <path
                      d="M0.5,0.8 L7,4 L0.5,7.2 z"
                      fill={tone === "bad" ? "var(--mark-gap)" : tone === "dead" ? "var(--rule)" : "var(--ink-3)"}
                    />
                  </marker>
                ))}
              </defs>
              {edges.map(({ flow, d, rate, dead, strained }) => {
                const tone = dead ? "dead" : strained ? "bad" : "base";
                const dash = flow.kind === "async" ? "5 4" : flow.kind === "push" ? "1.5 4" : undefined;
                return (
                  <g key={flow.id} opacity={dead ? 0.45 : 1}>
                    <path
                      d={d}
                      fill="none"
                      stroke={strained ? "var(--mark-gap)" : dead ? "var(--rule-strong)" : "var(--ink-3)"}
                      strokeOpacity={strained ? 0.75 : dead ? 1 : 0.55}
                      strokeWidth={flow.kind === "data" ? 2.4 : 1.4}
                      strokeDasharray={strained ? "4 4" : dash}
                      markerEnd={`url(#${markerId}-${tone})`}
                    />
                    {rate > 0 && !dead && (
                      <path
                        d={d}
                        fill="none"
                        stroke={strained ? "var(--mark-gap)" : "var(--traffic, var(--ink))"}
                        strokeWidth={3}
                        strokeLinecap="round"
                        strokeDasharray="0 16"
                        className="lc-dots"
                        style={{ "--lc-d": `${dotDuration(rate)}s` } as CSSProperties}
                      />
                    )}
                  </g>
                );
              })}
            </svg>

            {edges.map(({ flow, mid, rate, dead, strained }) =>
              rate > 0 && !dead ? (
                <span
                  key={flow.id}
                  className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-raised px-1.5 py-[1px] font-mono text-[10.5px] leading-[15px] whitespace-nowrap tabular-nums ${
                    strained ? "text-signal-gap" : "text-ink-2"
                  }`}
                  style={{
                    left: mid.x,
                    top: mid.y,
                    boxShadow: `0 0 0 1px ${strained ? "color-mix(in srgb, var(--mark-gap) 45%, transparent)" : "var(--rule)"}`,
                  }}
                >
                  {formatRate(rate)}
                </span>
              ) : null,
            )}

            {model.components.map((c) => {
              const b = box.get(c.id);
              if (!b) return null;
              const facts = factsOf(c, model, sim);
              const selected = selectedId === c.id;
              const down = facts.status === "down";
              const over = facts.status === "over";
              const hot = facts.status === "hot";
              const ring = selected
                ? "0 0 0 2px var(--ink)"
                : over
                  ? "0 0 0 1.5px var(--mark-gap)"
                  : hot
                    ? "0 0 0 1.5px var(--mark-partial)"
                    : down
                      ? "0 0 0 1px color-mix(in srgb, var(--mark-gap) 55%, transparent)"
                      : undefined;
              const barColor = over ? "var(--mark-gap)" : hot ? "var(--mark-partial)" : "var(--ink)";
              const client = c.role === "client";
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={selected}
                  aria-label={facts.aria}
                  title={`${c.label} · ${ROLE_LABEL[c.role]}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(selected ? null : c.id);
                  }}
                  className={`lc-card absolute flex cursor-pointer flex-col overflow-visible rounded-[10px] text-left ${
                    lit.has(c.id) ? "lc-pulse" : ""
                  } ${down ? "lc-hatch" : ""}`}
                  style={{
                    left: b.x,
                    top: b.y,
                    width: CARD_W,
                    height: CARD_H,
                    background: down
                      ? "color-mix(in srgb, var(--raised) 70%, var(--well))"
                      : over
                        ? "color-mix(in srgb, var(--signal-gap-soft) 55%, var(--raised))"
                        : "var(--raised)",
                    boxShadow: lit.has(c.id) ? undefined : ring ? `${ring}, 0 1px 2px var(--drop-1)` : "var(--shadow-btn)",
                  }}
                >
                  {c.added && (
                    <span className="absolute -top-2 right-2 rounded-full bg-raised px-1.5 font-mono text-[9.5px] leading-[15px] text-ink-3 shadow-[0_0_0_1px_var(--rule)]">
                      + added
                    </span>
                  )}
                  <span className="flex items-center gap-1.5 px-3 pt-2.5 text-ink-3">
                    <RoleIcon role={c.role} />
                    <span className="min-w-0 flex-1 truncate text-[13px] leading-4 font-medium tracking-[-0.01em] text-ink">
                      {c.label}
                    </span>
                    {facts.copies && (
                      <span className="shrink-0 font-mono text-[10.5px] leading-4 tabular-nums">{facts.copies}</span>
                    )}
                  </span>

                  {client ? (
                    <span className="mt-auto flex items-baseline gap-1.5 px-3 pb-3">
                      <span className="font-mono text-[19px] leading-none font-medium tracking-[-0.02em] tabular-nums text-ink">
                        {formatRate(facts.load)}
                      </span>
                      <span className="font-mono text-[10.5px] text-ink-3">sent</span>
                    </span>
                  ) : (
                    <>
                      <span className="mt-1.5 flex items-baseline gap-1.5 px-3">
                        {down ? (
                          <span className="font-mono text-[17px] leading-none font-medium text-signal-gap">down</span>
                        ) : facts.managed ? (
                          <>
                            <span className="font-mono text-[19px] leading-none font-medium tracking-[-0.02em] tabular-nums text-ink">
                              {formatRate(facts.load)}
                            </span>
                            <span className="font-mono text-[10.5px] text-ink-3">managed</span>
                          </>
                        ) : (
                          <>
                            <span
                              className={`font-mono text-[19px] leading-none font-medium tracking-[-0.02em] tabular-nums ${
                                over ? "text-signal-gap" : hot ? "text-signal-partial" : "text-ink"
                              }`}
                            >
                              {percent(facts.utilization)}
                            </span>
                            <span className="font-mono text-[10.5px] text-ink-3">busy</span>
                          </>
                        )}
                      </span>
                      <span className="mt-1.5 flex min-w-0 gap-2 truncate px-3 font-mono text-[10.5px] leading-4 tabular-nums text-ink-3">
                        {(down ? facts.line.slice(0, 1) : facts.line.slice(0, 2)).map((l) => (
                          <span
                            key={l.text}
                            className={
                              l.tone === "bad"
                                ? "text-signal-gap"
                                : l.tone === "warn"
                                  ? "text-signal-partial"
                                  : l.tone === "good"
                                    ? "text-signal-strong"
                                    : undefined
                            }
                          >
                            {l.text}
                          </span>
                        ))}
                      </span>
                      {!facts.managed && !down && (
                        <span className="absolute inset-x-3 bottom-2 h-[3px] overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--ink)_8%,transparent)]">
                          <span
                            className="block h-full rounded-full transition-[width] duration-300"
                            style={{ width: `${Math.min(100, Math.max(2, facts.utilization * 100))}%`, background: barColor }}
                          />
                        </span>
                      )}
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </figure>
  );
}
