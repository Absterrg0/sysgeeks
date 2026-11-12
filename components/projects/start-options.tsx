"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { AiLabel } from "@/components/ai";
import type { IntakeSource } from "@/lib/ai/requests";
import { type Project } from "@/lib/domain/learner";
import { uniqueSlug } from "@/lib/domain/layout";
import { saveProject, useLearnerState } from "@/lib/store/learner-store";

export type StartMethod = IntakeSource | "blank";

const AI_METHODS: { method: IntakeSource; title: string; body: string }[] = [
  {
    method: "description",
    title: "Describe it",
    body: "Write what it does, its parts and how they talk to each other.",
  },
  {
    method: "readme",
    title: "Paste a README",
    body: "Paste a README or design doc. We draft the model from what it says.",
  },
  {
    method: "repository",
    title: "From GitHub",
    body: "Give a public repository URL. We read its README, manifests and folder layout.",
  },
];

const CARD = "sheet-row block px-4 py-3.5 transition-colors hover:bg-[color-mix(in_srgb,var(--hover)_70%,transparent)] aria-[current=page]:bg-accent-soft";

/** Choose how to start: three AI drafts (on the learner's own key) and a blank model. Cards link to `/projects/new?method=…`. */
export function StartOptions({ selected = null }: { selected?: StartMethod | null }) {
  return (
    <div className="space-y-3">
      <div className="sheet overflow-hidden">
        {AI_METHODS.map(({ method, title, body }) => {
          const content = (
            <>
              <span className="flex items-baseline justify-between gap-3">
                <span className="text-[0.875rem] font-medium">{title}</span>
                <AiLabel kind="draft" />
              </span>
              <span className="mt-0.5 block text-[0.8125rem] leading-snug text-ink-3">{body}</span>
            </>
          );
          return (
            <Link
              key={method}
              href={`/projects/new?method=${method}`}
              aria-current={selected === method ? "page" : undefined}
              className={CARD}
            >
              {content}
            </Link>
          );
        })}
        <Link
          href="/projects/new?method=blank"
          aria-current={selected === "blank" ? "page" : undefined}
          className={CARD}
        >
          <span className="flex items-baseline justify-between gap-3">
            <span className="text-[0.875rem] font-medium">Start blank</span>
            <span className="text-small text-ink-3">No AI</span>
          </span>
          <span className="mt-0.5 block text-[0.8125rem] leading-snug text-ink-3">
            Name it and draw the parts yourself.
          </span>
        </Link>
      </div>
    </div>
  );
}

function newProject(name: string, summary: string, taken: string[]): Project {
  const now = new Date().toISOString();
  return {
    id: uniqueSlug(name, taken),
    name: name.trim(),
    summary: summary.trim(),
    source: { type: "manual" },
    components: [],
    flows: [],
    invariants: [],
    createdAt: now,
    updatedAt: now,
  };
}

/** The manual path: a name and a summary, then the model is built by hand in the workspace. */
export function BlankProjectForm() {
  const state = useLearnerState();
  const router = useRouter();
  const [name, setName] = useState("");
  const [summary, setSummary] = useState("");

  if (!state) return <div className="h-48 well" aria-busy="true" />;

  const create = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    const project = newProject(
      name,
      summary,
      state.projects.map((p) => p.id),
    );
    saveProject(project);
    router.push(`/projects/${project.id}`);
  };

  return (
    <form className="sheet max-w-xl space-y-4 p-5" onSubmit={create}>
      <div>
        <h2 className="text-[1rem] font-semibold">Start blank</h2>
        <p className="mt-1 text-small text-ink-3">No AI needed. You model the parts yourself.</p>
      </div>
      <div>
        <label htmlFor="project-name" className="eyebrow mb-2 block">
          Name
        </label>
        <input
          id="project-name"
          className="field"
          value={name}
          maxLength={120}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Course marketplace backend"
          required
        />
      </div>
      <div>
        <label htmlFor="project-summary" className="eyebrow mb-2 block">
          What does it do?
        </label>
        <textarea
          id="project-summary"
          className="field resize-y"
          rows={3}
          maxLength={2000}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="One or two sentences about what it does and who uses it."
        />
      </div>
      <button type="submit" className="btn btn-accent" disabled={!name.trim()}>
        Create and describe its architecture
      </button>
    </form>
  );
}
