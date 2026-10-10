import Link from "next/link";
import type { ReactNode } from "react";
import { AiBlock } from "@/components/ai";
import { ConfidenceChip } from "@/components/ai-run/confidence-chip";
import { InlineText, type ConceptResolver } from "@/components/prose-core";
import type { Review } from "@/lib/ai/schemas";

type Finding = Review["findings"][number];
type SuggestedInvariant = Review["suggestedInvariants"][number];

const GROUPS: { severity: Finding["severity"]; title: string }[] = [
  { severity: "high", title: "Gaps" },
  { severity: "medium", title: "Worth checking" },
  { severity: "low", title: "Smaller points" },
];

const CATEGORY: Record<Finding["category"], string> = {
  bottleneck: "Bottleneck",
  "failure-mode": "Failure mode",
  "missing-invariant": "Missing invariant",
  consistency: "Consistency",
  "scaling-cliff": "Scaling cliff",
  security: "Security",
  operability: "Operability",
};

/**
 * An AI review. Plain markup, so it renders on the server (the report page) and
 * inside the client workspace. Interactions are passed in as optional callbacks.
 */
export function ReportView({
  review,
  resolve,
  createdAt,
  componentLabels = {},
  onHighlight,
  onAddInvariant,
  addedStatements = [],
}: {
  review: Review;
  resolve: ConceptResolver;
  createdAt: Date | string;
  /** Component id to name. Ids are shown where a name is missing. */
  componentLabels?: Record<string, string>;
  /** Given in the workspace: clicking a component highlights it on the map. */
  onHighlight?: (componentIds: string[]) => void;
  /** Given in the workspace: "Add to model" on each suggested invariant. */
  onAddInvariant?: (invariant: SuggestedInvariant) => void;
  /** Statements already in the model. Those invariants read as added. */
  addedStatements?: readonly string[];
}) {
  const when = new Date(createdAt).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const chips = { labels: componentLabels, onHighlight };

  return (
    <AiBlock kind="review" provenance={`Reviewed your model · ${when} · not yet reviewed by you`}>
      <p className="text-small text-ink-3">The review reads your model, not your code. It can be wrong. Dismiss what doesn&rsquo;t apply.</p>
      <p className="text-ui text-ink-2">
        <InlineText text={review.summary} resolve={resolve} />
      </p>

      {review.strengths.length > 0 && (
        <section className="grid gap-3">
          <h3 className="font-heading text-h4">Strengths</h3>
          <ul className="grid gap-3">
            {review.strengths.map((strength, i) => (
              <li key={i} className="grid gap-1">
                <p className="text-ui font-medium text-ink">
                  <InlineText text={strength.title} resolve={resolve} />
                </p>
                <p className="text-ui text-ink-2">
                  <InlineText text={strength.detail} resolve={resolve} />
                </p>
                <ComponentChips ids={strength.componentIds} {...chips} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {GROUPS.map(({ severity, title }) => {
        const items = review.findings.filter((finding) => finding.severity === severity);
        if (items.length === 0) return null;
        return (
          <section key={severity} className="grid gap-3">
            <h3 className="font-heading text-h4">
              {title} <span className="font-mono text-micro text-ink-3">{items.length}</span>
            </h3>
            {items.map((finding) => (
              <FindingCard key={finding.id} finding={finding} resolve={resolve} {...chips} />
            ))}
          </section>
        );
      })}

      {review.suggestedInvariants.length > 0 && (
        <section className="grid gap-3">
          <h3 className="font-heading text-h4">Suggested invariants</h3>
          <ul className="grid gap-3">
            {review.suggestedInvariants.map((invariant) => {
              const added = addedStatements.includes(invariant.statement);
              return (
                <li key={invariant.statement} className="panel grid gap-2 p-4">
                  <p className="text-ui text-ink">
                    <InlineText text={invariant.statement} resolve={resolve} />
                  </p>
                  <p className="text-small text-ink-2">
                    <InlineText text={invariant.mechanism} resolve={resolve} />
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <ComponentChips ids={invariant.enforcedBy} {...chips} />
                    {added ? (
                      <span className="chip-flat">AI-drafted · in your model</span>
                    ) : (
                      onAddInvariant && (
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => onAddInvariant(invariant)}>
                          Add to model
                        </button>
                      )
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {review.questionsToAsk.length > 0 && (
        <section className="grid gap-3">
          <h3 className="font-heading text-h4">Questions to ask yourself</h3>
          <ul className="grid list-disc gap-2 pl-5 text-ui text-ink-2">
            {review.questionsToAsk.map((question, i) => (
              <li key={i}>
                <InlineText text={question} resolve={resolve} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </AiBlock>
  );
}

function FindingCard({
  finding,
  resolve,
  labels,
  onHighlight,
}: {
  finding: Finding;
  resolve: ConceptResolver;
  labels: Record<string, string>;
  onHighlight?: (componentIds: string[]) => void;
}) {
  return (
    <article className="panel grid gap-3 p-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="chip-flat">{CATEGORY[finding.category]}</span>
        <span className="text-small text-ink-3">Confidence</span>
        <ConfidenceChip level={finding.confidence} />
      </div>
      <h4 className="font-heading text-h4">
        <InlineText text={finding.title} resolve={resolve} />
      </h4>
      <FindingPart label="Scenario" text={finding.scenario} resolve={resolve} />
      <FindingPart label="Impact" text={finding.impact} resolve={resolve} />
      <FindingPart label="Recommendation" text={finding.recommendation} resolve={resolve} />
      <FindingPart label="Trade-off" text={finding.tradeoff} resolve={resolve} />
      {finding.assumes && <FindingPart label="Assumes" text={finding.assumes} resolve={resolve} />}
      <div className="flex flex-wrap items-center gap-2">
        <ComponentChips ids={finding.componentIds} labels={labels} onHighlight={onHighlight} />
        {finding.conceptIds.map((id) => (
          <Link key={id} href={`/concepts/${id}`} className="concept-link">
            {resolve(id)?.title ?? id}
          </Link>
        ))}
      </div>
    </article>
  );
}

function FindingPart({ label, text, resolve }: { label: string; text: string; resolve: ConceptResolver }) {
  return (
    <div className="grid gap-0.5">
      <p className="eyebrow">{label}</p>
      <p className="text-ui text-ink-2">
        <InlineText text={text} resolve={resolve} />
      </p>
    </div>
  );
}

function ComponentChips({
  ids,
  labels = {},
  onHighlight,
}: {
  ids: readonly string[];
  labels?: Record<string, string>;
  onHighlight?: (componentIds: string[]) => void;
}): ReactNode {
  return ids.map((id) =>
    onHighlight ? (
      <button key={id} type="button" className="chip" onClick={() => onHighlight([id])}>
        {labels[id] ?? id}
      </button>
    ) : (
      <span key={id} className="chip">
        {labels[id] ?? id}
      </span>
    ),
  );
}
