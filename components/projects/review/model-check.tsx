import Link from "next/link";
import type { ConceptResolver } from "@/components/prose-core";
import { lintModel } from "@/lib/domain/model-lint";
import type { ProjectModel } from "@/lib/domain/project-model";

/** The free, deterministic model check. Always visible in the review tab; no AI, no credits. */
export function ModelCheck({
  model,
  resolve,
  onHighlight,
}: {
  model: ProjectModel;
  resolve: ConceptResolver;
  onHighlight: (componentIds: string[]) => void;
}) {
  const empty = model.components.length === 0;
  const findings = empty ? [] : lintModel(model);

  return (
    <section className="panel grid gap-4 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-heading text-h3">Model check</h3>
        <span className="chip-flat">Free · runs on this device</span>
      </div>
      {empty ? (
        <p className="text-ui text-ink-2">Add components and flows, then the check will point at gaps in the model.</p>
      ) : findings.length === 0 ? (
        <p className="text-ui text-ink-2">
          Nothing to flag. The check is shallow: it cannot tell you the model is right.
        </p>
      ) : (
        <ul className="grid gap-3">
          {findings.map((finding, i) => (
            <li key={`${finding.ruleId}-${i}`} className="grid gap-1.5 border-t border-rule-soft pt-3 first:border-t-0 first:pt-0">
              <p className="text-ui text-ink">{finding.message}</p>
              <div className="flex flex-wrap items-center gap-2 text-small">
                {finding.conceptIds.map((id) => {
                  const concept = resolve(id);
                  return concept ? (
                    <Link key={id} href={`/concepts/${id}`} className="concept-link" title={concept.summary}>
                      {concept.title}
                    </Link>
                  ) : null;
                })}
                {finding.componentIds.length > 0 && (
                  <button type="button" className="link" onClick={() => onHighlight(finding.componentIds)}>
                    Show on map
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
