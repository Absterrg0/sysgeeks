"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { AiBlock } from "@/components/ai";
import { ConfidenceChip, type Confidence } from "@/components/ai-run/confidence-chip";
import { SystemMap } from "@/components/system-map";
import type { IntakeDraft } from "@/lib/ai/schemas";
import { draftToProject, type DraftKeep } from "@/lib/domain/draft";
import type { Project } from "@/lib/domain/learner";
import { autoLayout, uniqueSlug } from "@/lib/domain/layout";
import type { IntakeSource } from "@/lib/domain/pricing";
import { saveProject, useLearnerState } from "@/lib/store/learner-store";

export type IntakeResult = {
  draft: IntakeDraft;
  dropped: string[];
  source: { type: "description" } | { type: "repository"; url: string; commit?: string };
};

/** "Drafted from your README · 8 Oct, 14:02 · not yet reviewed by you". */
export function provenanceLine(method: IntakeSource, source: IntakeResult["source"], draftedAt: string): string {
  const from =
    source.type === "repository"
      ? source.url.replace(/^https?:\/\/(www\.)?github\.com\//, "")
      : method === "readme"
        ? "your README"
        : "your description";
  const when = new Date(draftedAt).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `Drafted from ${from} · ${when} · not yet reviewed by you`;
}

function projectSource(result: IntakeResult, runId: string | null, now: string): Project["source"] {
  if (result.source.type === "repository") {
    return {
      type: "repository",
      url: result.source.url,
      analyzedAt: now,
      commit: result.source.commit,
      runId: runId ?? undefined,
    };
  }
  return { type: "description", draftedAt: now, runId: runId ?? undefined };
}

function keepOf(draft: IntakeDraft, removed: ReadonlySet<string>): DraftKeep {
  return {
    components: draft.components.filter((c) => !removed.has(`c:${c.id}`)).map((c) => c.id),
    flows: draft.flows.filter((f) => !removed.has(`f:${f.id}`)).map((f) => f.id),
    invariants: draft.invariants.filter((i) => !removed.has(`i:${i.id}`)).map((i) => i.id),
  };
}

/**
 * The draft before anything is saved: the map, every item with its confidence
 * and reason, the open questions, and a remove toggle per item.
 */
export function DraftReview({
  result,
  runId,
  provenance,
  context,
}: {
  result: IntakeResult;
  runId: string | null;
  provenance: string;
  /** Scale and constraints the person typed, kept on the saved project. */
  context?: string;
}) {
  const router = useRouter();
  const learner = useLearnerState();
  const [removed, setRemoved] = useState<ReadonlySet<string>>(() => new Set());
  const { draft, dropped } = result;

  const toggle = (key: string) =>
    setRemoved((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const keep = keepOf(draft, removed);
  const preview = draftToProject(draft, { id: "preview", now: "", source: projectSource(result, runId, ""), keep });
  const placed = autoLayout(preview.components, preview.flows);
  const names = new Map(draft.components.map((c) => [c.id, c.label]));
  const nameOf = (id: string) => names.get(id) ?? id;

  const save = () => {
    const now = new Date().toISOString();
    const id = uniqueSlug(draft.name, learner?.projects.map((p) => p.id) ?? []);
    const project = draftToProject(draft, {
      id,
      now,
      source: projectSource(result, runId, now),
      context,
      keep,
    });
    saveProject(project);
    router.push(`/projects/${project.id}#model`);
  };

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="screen self-start xl:sticky xl:top-24">
        <SystemMap
          components={placed}
          flows={preview.flows}
          proposedComponents={preview.components.map((c) => c.id)}
          proposedFlows={preview.flows.map((f) => f.id)}
          label={`${draft.name}: drafted architecture`}
          compact
        />
      </div>

      <AiBlock kind="draft" provenance={provenance}>
        <h2 className="text-h3 font-medium text-ink">{draft.name}</h2>
        <p className="mt-1 text-ui text-ink-2">{draft.summary}</p>

        <ReviewSection title="Components" count={`${keep.components?.length ?? 0} of ${draft.components.length} kept`}>
          {draft.components.map((c) => (
            <ReviewItem
              key={c.id}
              label={c.label}
              tag={c.kind}
              confidence={c.confidence}
              off={removed.has(`c:${c.id}`)}
              onToggle={() => toggle(`c:${c.id}`)}
            >
              <p className="text-small text-ink-2">{c.responsibility}</p>
              {c.durableState && <p className="text-small text-ink-3">Keeps state: {c.durableState}</p>}
              <Why text={c.why} files={c.evidence?.map((e) => e.path)} />
            </ReviewItem>
          ))}
        </ReviewSection>

        {draft.flows.length > 0 && (
          <ReviewSection title="Flows" count={`${keep.flows?.length ?? 0} of ${draft.flows.length} kept`}>
            {draft.flows.map((f) => (
              <ReviewItem
                key={f.id}
                label={f.label}
                tag={f.kind}
                confidence={f.confidence}
                off={removed.has(`f:${f.id}`)}
                onToggle={() => toggle(`f:${f.id}`)}
              >
                <p className="text-small text-ink-2">
                  {nameOf(f.from)} → {nameOf(f.to)}
                </p>
                <Why text={f.why} />
              </ReviewItem>
            ))}
          </ReviewSection>
        )}

        {draft.invariants.length > 0 && (
          <ReviewSection
            title="Invariants"
            count={`${keep.invariants?.length ?? 0} of ${draft.invariants.length} kept`}
          >
            {draft.invariants.map((i) => (
              <ReviewItem
                key={i.id}
                label={i.statement}
                tag="invariant"
                confidence={i.confidence}
                off={removed.has(`i:${i.id}`)}
                onToggle={() => toggle(`i:${i.id}`)}
              >
                <p className="text-small text-ink-2">
                  Kept by {i.enforcedBy.map(nameOf).join(", ")}. {i.mechanism}
                </p>
                <Why text={i.why} files={i.evidence?.map((e) => e.path)} />
              </ReviewItem>
            ))}
          </ReviewSection>
        )}

        {draft.openQuestions.length > 0 && (
          <section className="mt-6">
            <h3 className="kicker">Open questions</h3>
            <p className="mt-1 text-small text-ink-3">What the AI could not tell from your input.</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-ui text-ink-2">
              {draft.openQuestions.map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ul>
          </section>
        )}

        {dropped.length > 0 && (
          <details className="mt-5 text-small text-ink-3">
            <summary className="cursor-pointer">
              {dropped.length} {dropped.length === 1 ? "item was" : "items were"} left out to keep the model valid
            </summary>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {dropped.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </details>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-rule-soft pt-4">
          <p className="text-small text-ink-3">Nothing is saved until you press Save project.</p>
          <div className="flex items-center gap-2">
            <Link href="/projects/new" className="btn btn-ghost">
              Start over
            </Link>
            <button
              type="button"
              className="btn btn-primary"
              onClick={save}
              disabled={!learner || preview.components.length === 0}
            >
              Save project
            </button>
          </div>
        </div>
      </AiBlock>
    </div>
  );
}

function ReviewSection({ title, count, children }: { title: string; count: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="kicker">{title}</h3>
        <span className="font-mono text-micro tabular-nums text-ink-3">{count}</span>
      </div>
      <ul className="mt-2 divide-y divide-rule-soft">{children}</ul>
    </section>
  );
}

function ReviewItem({
  label,
  tag,
  confidence,
  off,
  onToggle,
  children,
}: {
  label: string;
  tag: string;
  confidence: Confidence;
  off: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <li className={`grid gap-1.5 py-3 ${off ? "opacity-55" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`text-ui font-medium text-ink ${off ? "line-through" : ""}`}>{label}</span>
        <span className="chip-flat">{tag}</span>
        <ConfidenceChip level={confidence} />
        <button
          type="button"
          className="btn btn-ghost btn-sm ml-auto"
          aria-label={`${off ? "Restore" : "Remove"} ${label}`}
          onClick={onToggle}
        >
          {off ? "Restore" : "Remove"}
        </button>
      </div>
      {children}
    </li>
  );
}

function Why({ text, files }: { text: string; files?: string[] }) {
  return (
    <>
      <p className="text-small italic text-ink-3">{text}</p>
      {files && files.length > 0 && <p className="break-all font-mono text-micro text-ink-3">{files.join(" · ")}</p>}
    </>
  );
}
