"use client";

import { useState } from "react";
import { SignInGate } from "@/components/account/sign-in-gate";
import { AiBlock, AiLabel, StreamStatus } from "@/components/ai";
import { AiError } from "@/components/ai-run/ai-error";
import { InlineText } from "@/components/prose-core";
import { Segmented } from "@/components/ui";
import { AiFailure } from "@/lib/ai/errors";
import type { GradeResponseKind } from "@/lib/ai/requests";
import { type Account, useAccount } from "@/lib/client/account";
import { gradeAnswer } from "@/lib/client/ai";
import type { RubricPoint } from "@/lib/domain/content";
import {
  type AiAssessment,
  type Attempt,
  type Project,
  type Response,
  type SelfAssessment,
  type TailoredQuestion,
  exerciseKey,
} from "@/lib/domain/learner";
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
type SignedIn = Extract<Account, { signedIn: true }>;
type GradeBody = {
  exerciseKey: string;
  responseKind: GradeResponseKind;
  text: string;
  project?: Project;
  tailored?: Pick<TailoredQuestion, "id" | "runId">;
};
type GradeResult = { ok: true; assessment: AiAssessment };

const MODES: { value: Mode; label: string }[] = [
  { value: "self", label: "Assess it yourself" },
  { value: "ai", label: "Ask AI to assess" },
];

/**
 * "Assess your writing" under an answer. Self-assessment is always there and is
 * the default. When AI features are on, the learner can ask AI instead; the AI's
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
  const { data, refresh } = useAccount();
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
  if (!data?.features.ai || kind === null) return self;
  const account = data.signedIn ? data : null;

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
            <SignInGate>
              {account && (
                <AiRequest
                  account={account}
                  attemptId={attempt.id}
                  body={gradeBody(spec, kind, written.text)}
                  onAssessed={refresh}
                />
              )}
            </SignInGate>
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

/** Asks for the assessment. Grading is free but counted against the daily cap. */
function AiRequest({
  account,
  attemptId,
  body,
  onAssessed,
}: {
  account: SignedIn;
  attemptId: string;
  body: GradeBody;
  onAssessed: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<AiFailure | null>(null);
  const { used, limit } = account.quotas.grade;
  const left = Math.max(0, limit - used);
  const cost = account.costs.grade === 0 ? "Free" : `${account.costs.grade} credits`;

  async function ask() {
    setPending(true);
    setFailure(null);
    try {
      const result = await gradeAnswer<GradeResult>(body);
      attachAiAssessment(attemptId, result.assessment);
      onAssessed();
    } catch (error) {
      setFailure(error instanceof AiFailure ? error : new AiFailure("ai_unavailable"));
    } finally {
      setPending(false);
    }
  }

  if (pending) return <StreamStatus message="Assessing your answer against the rubric…" />;

  return (
    <div className="space-y-3">
      <div className="panel flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-ui text-ink-2 max-w-[60ch]">
          The AI marks each rubric point, quotes the passage that shows it, and says what is missing.
        </p>
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="chip-flat">
            {cost} · {left} of {limit} left today
          </span>
          <button type="button" className="btn btn-primary btn-sm" disabled={left === 0} onClick={ask}>
            Ask AI to assess
          </button>
        </div>
      </div>
      {failure && <AiError code={failure.code} refunded={failure.refunded} onRetry={ask} />}
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

/** Project questions send the project; tailored ones name their stored question, whose text the server reads itself. */
function gradeBody(spec: ExerciseSpec, responseKind: GradeResponseKind, text: string): GradeBody {
  const { ref, project } = spec;
  const body: GradeBody = { exerciseKey: exerciseKey(ref), responseKind, text };
  if (ref.kind !== "project-question") return body;
  const tailored = project?.tailoredQuestions?.find((question) => `ai.${question.id}` === ref.questionId);
  return { ...body, project, tailored: tailored && { id: tailored.id, runId: tailored.runId } };
}

/** Rubric points where your mark and the AI's differ. A point counts only when both sides marked it. */
function disagreements(rubric: readonly RubricPoint[], mine: SelfAssessment, theirs: SelfAssessment): number {
  return rubric.filter((point) => {
    const a = mine[point.id];
    const b = theirs[point.id];
    return a !== undefined && b !== undefined && a !== b;
  }).length;
}
