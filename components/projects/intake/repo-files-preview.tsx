import type { ProgressStep } from "@/components/ai-run/progress-steps";

/** The files a repository read selected, listed while the draft runs. Renders nothing for description runs. */
export function RepoFilesPreview({ steps }: { steps: readonly ProgressStep[] }) {
  const files = steps.findLast((step) => step.files)?.files;
  if (!files || files.length === 0) return null;
  return (
    <details open className="well-sm p-3">
      <summary className="cursor-pointer text-small text-ink-2">Selected {files.length} files</summary>
      <ul className="mt-2 max-h-56 space-y-0.5 overflow-auto font-mono text-micro text-ink-2">
        {files.map((file) => (
          <li key={file} className="break-all">
            {file}
          </li>
        ))}
      </ul>
    </details>
  );
}
