"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type RefObject, useEffect, useRef, useState } from "react";
import { AiGlyph } from "@/components/ai";
import { PROJECT_VIEWS, projectViewOf } from "@/components/investigation/system-bar";
import { ExerciseWorkspace } from "@/components/exercise/workspace";
import { EMPTY_SLOTS } from "@/components/exercise/types";
import { InlineText, ProseView, type ConceptResolver } from "@/components/prose-core";
import { SystemMap } from "@/components/system-map";
import { SignalBadge, SignalMeter } from "@/components/ui";
import { setHash, useHash } from "@/lib/client/use-hash";
import { exerciseKey, type LearnerState, type Project } from "@/lib/domain/learner";
import { autoLayout } from "@/lib/domain/layout";
import { modelHash } from "@/lib/domain/model-hash";
import { modelOf } from "@/lib/domain/project-model";
import {
  projectQuestions,
  QUESTION_GROUP_LABELS,
  QUESTION_GROUPS,
  type ProjectQuestion,
} from "@/lib/domain/project-questions";
import { exerciseStatus, latestEvidence, type ExerciseStatus } from "@/lib/domain/understanding";
import { deleteProject, saveProject, useLearnerState } from "@/lib/store/learner-store";
import { ContextField } from "./context-field";
import { ModelEditor } from "./model-editor";
import { ReviewTab } from "./review/review-tab";
import { TailoredQuestionsPanel } from "./tailored-questions-panel";

type Tab = "questions" | "model" | "review";

const KICKER: Record<Project["source"]["type"], string> = {
  manual: "Project · by hand",
  description: "Project · from your description",
  repository: "Project · from GitHub",
};

function repoName(url: string): string {
  try {
    return new URL(url).pathname.replace(/^\/+|\/+$|\.git$/g, "");
  } catch {
    return url;
  }
}

function sourceLabel(source: Project["source"]): string {
  switch (source.type) {
    case "manual":
      return "Described by hand";
    case "description":
      return "Drafted by AI from your description";
    case "repository":
      return `Drafted by AI from ${repoName(source.url)}${source.commit ? `@${source.commit.slice(0, 7)}` : ""}`;
  }
}

export function ProjectWorkspace({
  projectId,
  concepts,
}: {
  projectId: string;
  concepts: Record<string, { title: string; summary: string }>;
}) {
  const state = useLearnerState();
  if (!state)
    return (
      <div className="section">
        <div className="h-96 well" aria-busy="true" />
      </div>
    );
  const project = state.projects.find((p) => p.id === projectId);
  if (!project) {
    return (
      <div className="section max-w-xl space-y-4">
        <h1 className="font-display text-[1.875rem] leading-tight">Project not found</h1>
        <p className="text-ink-2">
          There is no project with this address in this browser. Projects live in local storage, so they do not follow
          you between browsers unless you export and import them.
        </p>
        <Link href="/projects" className="btn btn-secondary">
          Back to your projects
        </Link>
      </div>
    );
  }
  return <ProjectView key={project.id} project={project} concepts={concepts} />;
}

function ProjectView({
  project,
  concepts,
}: {
  project: Project;
  concepts: Record<string, { title: string; summary: string }>;
}) {
  const state = useLearnerState();
  const storeState = useRef(state);
  useEffect(() => {
    storeState.current = state;
  });
  const router = useRouter();
  // The tabs live in the system bar; the #fragment says which view is open.
  const view = projectViewOf(useHash(), project.components.length > 0);
  const tab: Tab = view === "design" ? "model" : view === "ask-ai" ? "review" : "questions";
  const setTab = (next: Tab) => setHash(next === "model" ? "design" : next === "review" ? "ask-ai" : "interview");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [highlight, setHighlight] = useState<string[]>([]);
  const attempts = state?.attempts ?? [];
  const questions = projectQuestions(project);
  const resolve: ConceptResolver = (id) => concepts[id];
  const updated = new Date(project.updatedAt).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div>
      <header className="section rise">
        <p className="kicker">{KICKER[project.source.type]}</p>
        <h1 className="mt-3 font-display text-[1.875rem] leading-[1.1] text-balance sm:text-[2.25rem]">
          {project.name}
        </h1>
        {project.summary && <p className="mt-3 max-w-[62ch] text-lede text-ink-2">{project.summary}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          {project.source.type === "manual" ? (
            <span className="chip">{sourceLabel(project.source)}</span>
          ) : (
            <span className="ai-label">
              <AiGlyph />
              {sourceLabel(project.source)}
            </span>
          )}
          <span className="chip">Updated {updated}</span>
        </div>
      </header>

      {project.components.length > 0 && (
        <section aria-label="Architecture map" className="relative section">
          <div className="matrix-lit [--matrix-bottom:-6%] [--matrix-top:-6%]" aria-hidden="true" />
          <SystemMap
            bare
            live
            label={`${project.name} architecture`}
            components={autoLayout(project.components, project.flows)}
            flows={project.flows}
            highlight={highlight}
          />
        </section>
      )}

      <div className="section">
        <div id="project-panel" aria-label={PROJECT_VIEWS.find((v) => v.id === view)?.label}>
          {tab === "questions" ? (
            <div>
              {project.components.length === 0 ? (
                <p className="mb-8 max-w-2xl text-ui text-ink-2">
                  Only the general questions apply until you describe the system.{" "}
                  <button type="button" className="link" onClick={() => setTab("model")}>
                    Add components and flows
                  </button>{" "}
                  to get questions about your specific request paths, state and dependencies.
                </p>
              ) : null}
              <QuestionList
                project={project}
                questions={questions}
                attempts={attempts}
                resolve={resolve}
                storeState={storeState}
              />
            </div>
          ) : tab === "model" ? (
            <div>
              <div className="mb-10 max-w-2xl">
                <ContextField project={project} />
              </div>
              <ModelEditor
                key={modelHash(modelOf(project))}
                project={project}
                onSave={(model) => {
                  saveProject({
                    ...project,
                    ...model,
                    updatedAt: new Date().toISOString(),
                  });
                }}
              />
              <div className="mt-2 border-t border-rule-soft pt-6">
                {confirmDelete ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-small text-ink-2">Delete this project and every answer about it?</p>
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={() => {
                        router.push("/projects");
                        deleteProject(project.id);
                      }}
                    >
                      Delete project
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button type="button" className="btn btn-danger" onClick={() => setConfirmDelete(true)}>
                    Delete project
                  </button>
                )}
              </div>
            </div>
          ) : (
            <ReviewTab project={project} resolve={resolve} onHighlight={setHighlight} />
          )}
        </div>
      </div>
    </div>
  );
}

function QuestionList({
  project,
  questions,
  attempts,
  resolve,
  storeState,
}: {
  project: Project;
  questions: ProjectQuestion[];
  attempts: NonNullable<ReturnType<typeof useLearnerState>>["attempts"];
  resolve: ConceptResolver;
  storeState: RefObject<LearnerState | null>;
}) {
  const [open, setOpen] = useState<string | null>(() => {
    const hash = window.location.hash.slice(1);
    return questions.some((q) => q.id === hash) ? hash : null;
  });
  const refOf = (q: ProjectQuestion) => ({
    kind: "project-question" as const,
    projectId: project.id,
    questionId: q.id,
  });
  const latest = latestEvidence(attempts);
  const counts = { strong: 0, partial: 0, gap: 0 };
  const weak: ProjectQuestion[] = [];
  for (const q of questions) {
    const e = latest.get(exerciseKey(refOf(q)));
    if (!e) continue;
    counts[e.evidence.signal]++;
    if (e.evidence.signal !== "strong") weak.push(q);
  }
  const answered = counts.strong + counts.partial + counts.gap;

  return (
    <div className="space-y-10">
      <section aria-labelledby="coverage" className="tint grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div>
          <h2 id="coverage" className="font-heading text-h3">
            How well you can explain it
          </h2>
          <p className="mt-2 max-w-2xl text-ui leading-relaxed text-ink-2">
            {answered === 0
              ? "Answer as you would in an interview, then compare your answer with what a strong one covers. Questions you cannot answer well are the parts of your own system to go and read."
              : `You have answered ${answered} of ${questions.length}. ${
                  weak.length === 0
                    ? "Every answer so far covered the key points."
                    : `${weak.length} came up short; those are the parts of ${project.name} worth going back to the code for.`
                }`}
          </p>
          {weak.length > 0 && (
            <ul className="mt-4 space-y-1.5">
              {weak.map((q) => (
                <li key={q.id}>
                  <a
                    href={`#${q.id}`}
                    onClick={() => setOpen(q.id)}
                    className="text-small text-ink underline decoration-rule-strong underline-offset-4 hover:text-accent"
                  >
                    <InlineText text={q.title} />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
        {answered > 0 && (
          <div className="lg:pt-2">
            <SignalMeter counts={counts} label={`${project.name} answers`} />
          </div>
        )}
      </section>

      <TailoredQuestionsPanel project={project} attempts={attempts} storeState={storeState} />

      {QUESTION_GROUPS.map((group) => {
        const inGroup = questions.filter((q) => q.group === group);
        if (inGroup.length === 0) return null;
        return (
          <section key={group} aria-labelledby={`group-${group}`}>
            <div className="mb-3 flex flex-wrap items-baseline gap-x-2.5">
              <h2 id={`group-${group}`} className="font-heading text-h4">
                {QUESTION_GROUP_LABELS[group].label}
              </h2>
              <p className="text-small text-ink-3">{QUESTION_GROUP_LABELS[group].description}</p>
            </div>
            <ul className="panel divide-y divide-rule-soft">
              {inGroup.map((q) => {
                const status = exerciseStatus(attempts, refOf(q));
                const isOpen = open === q.id;
                return (
                  <li key={q.id} id={q.id} className="scroll-mt-16">
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={`q-${q.id}`}
                      onClick={() => setOpen(isOpen ? null : q.id)}
                      className="group flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
                    >
                      <span className="min-w-0 text-ui group-hover:text-accent">
                        <InlineText text={q.title} />
                      </span>
                      <span className="flex shrink-0 items-center gap-3">
                        {q.aiWritten && (
                          <span className="ai-label">
                            <AiGlyph />
                            AI-written
                          </span>
                        )}
                        <QuestionStatus status={status} />
                        <span className="knob size-6 font-mono text-small" aria-hidden="true">
                          {isOpen ? "−" : "+"}
                        </span>
                      </span>
                    </button>
                    {isOpen && (
                      <div id={`q-${q.id}`} className="border-t border-rule-soft bg-well px-4 pb-6 pt-5 sm:px-6">
                        <ExerciseWorkspace
                          spec={{
                            ref: refOf(q),
                            interaction: q.interaction,
                            tags: q.tags,
                            project,
                          }}
                          slots={{
                            ...EMPTY_SLOTS,
                            reference: <ProseView text={q.interaction.reference} resolve={resolve} />,
                          }}
                          context="practice"
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function QuestionStatus({ status }: { status: ExerciseStatus }) {
  if (status === "unattempted") return <span className="chip-flat">Not answered</span>;
  if (status === "awaiting-assessment") return <span className="chip-flat">Needs assessment</span>;
  return <SignalBadge signal={status} />;
}
