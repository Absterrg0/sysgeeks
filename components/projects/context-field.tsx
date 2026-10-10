"use client";

import { useId, useState } from "react";
import { MAX_PROJECT_CONTEXT, type Project } from "@/lib/domain/learner";
import { saveProject } from "@/lib/store/learner-store";

/** Scale and constraints for AI. Saved on its own, so it never touches the model draft. */
export function ContextField({ project }: { project: Project }) {
  const id = useId();
  const [draft, setDraft] = useState(project.context ?? "");
  const dirty = draft.trim() !== (project.context ?? "").trim();

  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="eyebrow">
        Scale and constraints
      </label>
      <textarea
        id={id}
        className="field resize-y"
        rows={3}
        maxLength={MAX_PROJECT_CONTEXT}
        value={draft}
        placeholder="For example: about 2,000 requests a second at peak, EU customers only, a team of four with one on-call engineer."
        onChange={(event) => setDraft(event.target.value)}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-small text-ink-3">
          AI reads this with the model. {draft.length} / {MAX_PROJECT_CONTEXT}
        </p>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={!dirty}
          onClick={() =>
            saveProject({
              ...project,
              context: draft.trim() || undefined,
              updatedAt: new Date().toISOString(),
            })
          }
        >
          Save context
        </button>
      </div>
    </div>
  );
}
