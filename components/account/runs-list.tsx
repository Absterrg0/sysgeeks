"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatDay } from "@/components/account/ledger-table";
import type { AiFeature } from "@/lib/domain/pricing";

export type RunRow = {
  id: string;
  feature: AiFeature;
  status: "running" | "succeeded" | "failed";
  credits: number;
  refunded: boolean;
  title: string | null;
  createdAt: Date;
  hasOutput: boolean;
};

const FEATURE_LABEL: Record<AiFeature, string> = {
  intake: "Project draft",
  review: "Architecture review",
  questions: "Tailored questions",
  grade: "Answer grading",
  interview: "AI interviewer",
};

const STATUS_LABEL: Record<RunRow["status"], string> = {
  running: "Running",
  succeeded: "Done",
  failed: "Failed",
};

/** Where a finished run's output can be opened, if it has a page of its own. */
function openLink(run: RunRow): { href: string; label: string } | null {
  if (!run.hasOutput || run.status !== "succeeded") return null;
  if (run.feature === "review") return { href: `/reports/${run.id}`, label: "Open report" };
  if (run.feature === "intake") return { href: `/projects/new?run=${run.id}`, label: "Create project from this draft" };
  return null;
}

/** AI runs, newest first. Deleting a run removes its saved output but keeps the row and its credits. */
export function RunsList({ runs }: { runs: readonly RunRow[] }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, startDelete] = useTransition();

  if (runs.length === 0) return <p className="text-ui text-ink-2">No AI runs yet.</p>;

  const remove = (id: string) => {
    setError(null);
    startDelete(async () => {
      const res = await fetch(`/api/ai/runs/${id}`, { method: "DELETE" });
      if (!res.ok) {
        setError("That output could not be deleted. Try again.");
        return;
      }
      setConfirming(null);
      router.refresh();
    });
  };

  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Run</th>
            <th scope="col">Status</th>
            <th scope="col" className="text-right">
              Credits
            </th>
            <th scope="col">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => {
            const link = openLink(run);
            const canDelete = run.hasOutput && run.status !== "running";
            return (
              <tr key={run.id}>
                <td className="whitespace-nowrap tabular-nums">{formatDay(run.createdAt)}</td>
                <th scope="row" className="min-w-40">
                  {FEATURE_LABEL[run.feature]}
                  {run.title && <span className="block text-small font-normal text-ink-3">{run.title}</span>}
                </th>
                <td className="whitespace-nowrap">
                  {STATUS_LABEL[run.status]}
                  {run.refunded && <span className="kicker ml-2">Refunded</span>}
                </td>
                <td className="whitespace-nowrap text-right font-mono tabular-nums">
                  <span className={run.refunded ? "text-ink-3 line-through" : undefined}>&minus;{run.credits}</span>
                </td>
                <td>
                  {confirming === run.id ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-small text-ink-2">Delete this output? The run stays listed.</span>
                      <button
                        type="button"
                        className="btn btn-danger-solid btn-sm"
                        disabled={deleting}
                        onClick={() => remove(run.id)}
                      >
                        Delete
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirming(null)}>
                        Keep
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      {link && (
                        <Link href={link.href} className="link">
                          {link.label}
                        </Link>
                      )}
                      {canDelete && (
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirming(run.id)}>
                          Delete output
                        </button>
                      )}
                      {!run.hasOutput && run.status !== "running" && (
                        <span className="text-small text-ink-3">No saved output</span>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {error && (
        <p role="alert" className="mt-3 text-small text-ink-2">
          {error}
        </p>
      )}
    </div>
  );
}
