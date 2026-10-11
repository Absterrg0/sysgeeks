"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { InvestigationProgress } from "@/components/investigation/progress";
import { StageControls, type StageBarInvestigation } from "@/components/investigation/stage-bar";
import { setHash, useHash } from "@/lib/client/use-hash";
import { useLearnerState } from "@/lib/store/learner-store";

export type SystemMode = "learn" | "play" | "interview" | "walkthrough";

const MODES: { mode: SystemMode; label: string; path: string }[] = [
  { mode: "learn", label: "Learn", path: "" },
  { mode: "play", label: "Play", path: "/playground" },
  { mode: "interview", label: "Interview", path: "/design" },
  { mode: "walkthrough", label: "Walkthrough", path: "/review" },
];

/** Which mode of a system a path is in, and the stage when it is a stage. */
export function systemModeOf(path: string, investigationId: string): { mode: SystemMode; stageId?: string } {
  const rest = path.slice(`/investigations/${investigationId}`.length).replace(/\/$/, "");
  if (rest === "/playground") return { mode: "play" };
  if (rest === "/design") return { mode: "interview" };
  if (rest === "/review") return { mode: "walkthrough" };
  return rest.length > 1 ? { mode: "learn", stageId: rest.slice(1) } : { mode: "learn" };
}

/** A system's outline, the size of an icon: its parts where they sit, the stores lit. */
export function SystemGlyph({ outline }: { outline?: { col: number; row: number; store: boolean }[] }) {
  if (!outline || outline.length === 0) {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <rect x="1.5" y="2.5" width="5" height="4" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <rect x="9.5" y="2.5" width="5" height="4" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <rect x="5.5" y="9.5" width="5" height="4" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    );
  }
  const cols = outline.map((p) => p.col);
  const rows = outline.map((p) => p.row);
  const c0 = Math.min(...cols);
  const r0 = Math.min(...rows);
  const w = (Math.max(...cols) - c0 + 1) * 10;
  const h = (Math.max(...rows) - r0 + 1) * 8;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-3.5 w-auto max-w-6" aria-hidden="true">
      {outline.map((p, i) => (
        <rect
          key={i}
          x={(p.col - c0) * 10 + 1.5}
          y={(p.row - r0) * 8 + 2}
          width={7}
          height={4}
          rx={1}
          fill={p.store ? "var(--accent-solid)" : "var(--ink-2)"}
          fillOpacity={p.store ? 1 : 0.7}
        />
      ))}
    </svg>
  );
}

/**
 * The drawer that slides out from under the floating bar on anything you work on: which thing it is, its modes
 * as a switch, and on the right whatever belongs there (progress, stage controls).
 */
export function WorkspaceBar({
  title,
  detail,
  glyph,
  href,
  label,
  tabs,
  end,
}: {
  title: string;
  /** One quiet line under the title, e.g. "Foundational · 9 stages". */
  detail?: string;
  glyph?: ReactNode;
  href: string;
  label: string;
  tabs: { label: string; href: string; current: boolean; onClick?: () => void }[];
  end?: ReactNode;
}) {
  return (
    <div className="nav-drawer">
      <nav aria-label={label} className="flex h-[3.25rem] items-center gap-3 px-2 md:grid md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:px-2.5">
        <Link href={href} className="group hidden min-w-0 items-center gap-2.5 rounded-lg py-1 pr-2 md:flex" title={title}>
          <span className="grid h-7 w-8 shrink-0 place-items-center rounded-md bg-raised text-ink-2 shadow-[inset_0_0_0_1px_var(--edge-strong)]">
            {glyph}
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[0.8125rem] font-medium text-ink group-hover:text-accent">{title}</span>
            {detail && <span className="block truncate text-[0.6875rem] text-ink-3">{detail}</span>}
          </span>
        </Link>
        <ul className="seg min-w-0 overflow-x-auto md:col-start-2 md:justify-self-center">
          {tabs.map((tab) => (
            <li key={tab.label}>
              <Link
                href={tab.href}
                aria-current={tab.current ? "page" : undefined}
                className="seg-item"
                onClick={tab.onClick}
              >
                {tab.label}
              </Link>
            </li>
          ))}
        </ul>
        {end && <div className="ml-auto flex shrink-0 items-center md:col-start-3 md:ml-0 md:justify-self-end">{end}</div>}
      </nav>
    </div>
  );
}

/**
 * The workspace every system opens in: which system, its four modes, and how far along you are, or the
 * stage controls while a stage is open.
 */
export function SystemBar({ investigation, path }: { investigation: StageBarInvestigation; path: string }) {
  const base = `/investigations/${investigation.id}`;
  const { mode, stageId } = systemModeOf(path, investigation.id);
  return (
    <WorkspaceBar
      title={investigation.title}
      detail={[investigation.level, `${investigation.stages.length} stages`].filter(Boolean).join(" · ")}
      glyph={<SystemGlyph outline={investigation.outline} />}
      href={base}
      label={`${investigation.title}: workspace`}
      tabs={MODES.filter((m) => m.mode !== "play" || investigation.hasPlayground).map((m) => ({
        label: m.label,
        href: `${base}${m.path}`,
        current: mode === m.mode,
      }))}
      end={
        stageId ? (
          <StageControls investigation={investigation} current={stageId} />
        ) : (
          <span className="hidden text-[0.8125rem] sm:block">
            <InvestigationProgress investigationId={investigation.id} stages={investigation.stages} />
          </span>
        )
      }
    />
  );
}

/** Your own system's views, in the order you use them. */
export const PROJECT_VIEWS = [
  { id: "design", label: "Design" },
  { id: "interview", label: "Interview" },
  { id: "ask-ai", label: "Ask AI" },
] as const;
export type ProjectView = (typeof PROJECT_VIEWS)[number]["id"];

/** The view a project opens in: its #fragment, or design when there is nothing to ask about yet. */
export function projectViewOf(hash: string, hasComponents: boolean): ProjectView {
  if (hash === "model") return "design";
  const known = PROJECT_VIEWS.find((v) => v.id === hash);
  if (known) return known.id;
  return hasComponents ? "interview" : "design";
}

/** The same workspace for a system you brought: design it, get interviewed on it, ask AI about it. */
export function ProjectBar({ projectId }: { projectId: string }) {
  const state = useLearnerState();
  const hash = useHash();
  const project = state?.projects.find((p) => p.id === projectId);
  if (!project) return null;
  const view = projectViewOf(hash, project.components.length > 0);
  return (
    <WorkspaceBar
      title={project.name}
      detail={`Your system · ${project.components.length} part${project.components.length === 1 ? "" : "s"}`}
      glyph={<SystemGlyph />}
      href={`/projects/${project.id}`}
      label={`${project.name}: workspace`}
      tabs={PROJECT_VIEWS.map((v) => ({
        label: v.label,
        href: `#${v.id}`,
        current: view === v.id,
        onClick: () => setHash(v.id),
      }))}
      
    />
  );
}
