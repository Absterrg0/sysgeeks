"use client";

import { useState } from "react";
import { AiBlock, AiLabel, StreamStatus } from "@/components/ai";
import { AiKeyGate, AiModelTag } from "@/components/ai-key/ai-key-gate";
import { AiError } from "@/components/ai-run/ai-error";
import { InlineText } from "@/components/prose-core";
import { Segmented } from "@/components/ui";
import { AiFailure } from "@/lib/ai/errors";
import type { GradeResponseKind } from "@/lib/ai/requests";
import { gradeAnswer } from "@/lib/client/ai";
import type { GradeSubject } from "@/lib/ai/prompts/grade";
import type { RubricPoint } from "@/lib/domain/content";
import type { AiAssessment, Attempt, Response, SelfAssessment } from "@/lib/domain/learner";
import { assessAttempt, attachAiAssessment } from "@/lib/store/learner-store";
import {
  MARK_CLASS,
  MARK_LABEL,
  MARK_LED,
  RubricAssessment,
  RubricResult,
  WrittenText,
  type Written,
} from "./rubric";
import type { ExerciseSpec } from "./types";

type Mode = "self" | "ai";

const MODES: { value: Mode; label: string }[] = [
  { value: "self", label: "Assess it yourself" },
  { value: "ai", label: "Ask AI to assess" },
];

/**
 * "Assess your writing" under an answer. Self-assessment is always there and is
 * the default. With their own API key, the learner can ask AI instead; the AI's
 * marks are kept on the attempt either way, so disagreements can be shown.
 */
export function WritingAssessment({
  attempt,
  spec,
  rubric,
  written,
}: {
  attempt: Attempt;
  spec: ExerciseSpec;
  rubric: readonly RubricPoint[];
  written: Written;
}) {
  const [mode, setMode] = useState<Mode>(attempt.aiAssessment ? "ai" : "self");
  const [revising, setRevising] = useState(false);
  const name = `assess-${attempt.id}`;
  const { interaction, tags } = spec;
  const ai = attempt.aiAssessment;

  const self = (
    <RubricAssessment
      rubric={rubric}
      written={written}
      name={name}
      onSubmit={(marks, citations) => {
        assessAttempt({ attempt, interaction, tags, selfAssessment: marks, citations });
        setRevising(false);
      }}
    />
  );

  if (attempt.selfAssessment && attempt.evidence && !revising) {
    return (
      <Assessed
        attempt={attempt}
        marks={attempt.selfAssessment}
        rubric={rubric}
        written={written}
        onRevise={() => setRevising(true)}
      />
    );
  }

  if (revising) {
    return (
      <div className="space-y-4">
        {self}
        {attempt.assessor === "ai" && (
          <button type="button" className="link text-small" onClick={() => setRevising(false)}>
            Keep the AI&rsquo;s assessment
          </button>
        )}
      </div>
    );
  }

  const kind = gradeKind(attempt.response);
  if (kind === null) return self;

  return (
    <div className="space-y-5">
      <Segmented name={`${name}-mode`} legend="Who assesses it" options={MODES} value={mode} onChange={setMode} />
      {mode === "self" ? (
        self
      ) : (
        <div className="space-y-5">
          <WrittenText written={written} />
          {ai ? (
            <AiResult
              ai={ai}
              rubric={rubric}
              mono={written.mono}
              onUse={() =>
                assessAttempt({
                  attempt,
                  interaction,
                  tags,
                  selfAssessment: ai.marks,
                  citations: ai.citations,
                  assessor: "ai",
                })
              }
              onMyself={() => setMode("self")}
            />
          ) : (
            <AiKeyGate>
              <AiRequest attemptId={attempt.id} subject={subjectOf(spec)} kind={kind} text={written.text} />
            </AiKeyGate>
          )}
        </div>
      )}
    </div>
  );
}

/** Your marks, with the AI's disagreements when it has also marked the answer. */
function Assessed({
  attempt,
  marks,
  rubric,
  written,
  onRevise,
}: {
  attempt: Attempt;
  marks: SelfAssessment;
  rubric: readonly RubricPoint[];
  written: Written;
  onRevise: () => void;
}) {
  const byAi = attempt.assessor === "ai";
  const differing = attempt.aiAssessment && !byAi ? disagreements(rubric, marks, attempt.aiAssessment.marks) : null;

  return (
    <div className="space-y-4">
      {byAi && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <AiLabel kind="assessed" />
          <button type="button" className="link text-small" onClick={onRevise}>
            Disagree? Mark it yourself
          </button>
        </div>
      )}
      <RubricResult rubric={rubric} marks={marks} citations={attempt.citations} written={written} />
      {differing !== null && (
        <p className="text-small text-ink-2">
          {differing === 0
            ? "You and the AI agreed on every point."
            : `You and the AI disagreed on ${differing} ${differing === 1 ? "point" : "points"}.`}
        </p>
      )}
    </div>
  );
}

/** The AI's assessment, shown for the learner to accept or set aside. */
function AiResult({
  ai,
  rubric,
  mono,
  onUse,
  onMyself,
}: {
  ai: AiAssessment;
  rubric: readonly RubricPoint[];
  mono?: boolean;
  onUse: () => void;
  onMyself: () => void;
}) {
  const when = new Date(ai.assessedAt).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <AiBlock
      kind="assessed"
      provenance={`Assessed by AI (${ai.model}) · ${when} · not yet accepted by you`}
      actions={
        <>
          <button type="button" className="btn btn-primary btn-sm" onClick={onUse}>
            Use this assessment
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onMyself}>
            Assess it myself instead
          </button>
        </>
      }
    >
      <ul className="panel divide-y divide-rule-soft px-4">
        {rubric.map((point) => {
          const mark = ai.marks[point.id];
          const citation = ai.citations[point.id];
          const note = ai.notes[point.id];
          return (
            <li key={point.id} className="py-3 flex items-start gap-4 text-[0.875rem]">
              <span
                className={`w-20 shrink-0 inline-flex items-center gap-2 text-sm font-medium ${mark ? MARK_CLASS[mark] : "text-ink-3"}`}
              >
                <span className={`led ${mark ? MARK_LED[mark] : "led-off"} size-1.5`} aria-hidden="true" />
                {mark ? MARK_LABEL[mark] : "Unmarked"}
              </span>
              <span className="min-w-0 leading-relaxed">
                <InlineText text={point.text} />
                {citation && (
                  <span className={`mt-1 block text-[0.8125rem] text-ink-3 ${mono ? "font-mono text-[0.75rem]" : ""}`}>
                    <q>{citation}</q>
                  </span>
                )}
                {note && <span className="mt-1 block text-[0.8125rem] text-ink-2">{note}</span>}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="text-ui text-ink-2">{ai.summary}</p>
    </AiBlock>
  );
}

/** Asks for the assessment, on the learner's own key. */
function AiRequest({
  attemptId,
  subject,
  kind,
  text,
}: {
  attemptId: string;
  subject: GradeSubject;
  kind: GradeResponseKind;
  text: string;
}) {
  const [pending, setPending] = useState<AbortController | null>(null);
  const [failure, setFailure] = useState<AiFailure | null>(null);

  async function ask() {
    const controller = new AbortController();
    setPending(controller);
    setFailure(null);
    try {
      attachAiAssessment(attemptId, await gradeAnswer(subject, kind, text, controller.signal));
    } catch (error) {
      setFailure(error instanceof AiFailure ? error : new AiFailure("ai_unavailable"));
    } finally {
      setPending(null);
    }
  }

  if (pending) {
    return <StreamStatus message="Assessing your answer against the rubric…" onStop={() => pending.abort()} />;
  }

  return (
    <div className="space-y-3">
      <div className="panel flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="grid gap-1">
          <p className="text-ui text-ink-2 max-w-[60ch]">
            The AI marks each rubric point, quotes the passage that shows it, and says what is missing.
          </p>
          <AiModelTag />
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={ask}>
          Ask AI to assess
        </button>
      </div>
      {failure && <AiError code={failure.code} detail={failure.detail} onRetry={ask} />}
    </div>
  );
}

/** Only written answers have a rubric the AI can mark, and the API accepts only these kinds. */
function gradeKind(response: Response): GradeResponseKind | null {
  switch (response.kind) {
    case "open":
    case "decision":
    case "diagnosis":
    case "implementation":
      return response.kind;
    default:
      return null;
  }
}

/** The exercise as the grader needs it. Pages pass the title; the prompt's first line stands in when one doesn't. */
function subjectOf(spec: ExerciseSpec): GradeSubject {
  const prompt = "prompt" in spec.interaction ? spec.interaction.prompt : "";
  return {
    ref: spec.ref,
    interaction: spec.interaction,
    title: spec.title ?? (prompt.split("\n")[0]?.slice(0, 120) || "Written answer"),
    context: spec.context,
  };
}

/** Rubric points where your mark and the AI's differ. A point counts only when both sides marked it. */
function disagreements(rubric: readonly RubricPoint[], mine: SelfAssessment, theirs: SelfAssessment): number {
  return rubric.filter((point) => {
    const a = mine[point.id];
    const b = theirs[point.id];
    return a !== undefined && b !== undefined && a !== b;
  }).length;
}
