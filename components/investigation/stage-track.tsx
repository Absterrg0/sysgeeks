import Link from "next/link";

/**
 * Where this stage sits in the system: one segment per stage, the ones behind you in ink, this one in ember.
 * Each segment links to its stage.
 */
export function StageTrack({
  investigationId,
  stages,
  index,
}: {
  investigationId: string;
  stages: { id: string; title: string }[];
  index: number;
}) {
  return (
    <ol className="flex gap-1" aria-label={`Stage ${index + 1} of ${stages.length}`}>
      {stages.map((s, i) => (
        <li key={s.id} className="min-w-0 flex-1">
          <Link
            href={`/investigations/${investigationId}/${s.id}`}
            prefetch={false}
            title={`${i + 1}. ${s.title}`}
            aria-current={i === index ? "step" : undefined}
            className="group block py-1.5"
          >
            <span className="sr-only">
              Stage {i + 1}: {s.title}
            </span>
            <span
              aria-hidden="true"
              className={`block h-[3px] rounded-full transition-colors ${
                i === index
                  ? "bg-accent-solid"
                  : i < index
                    ? "bg-ink/70 group-hover:bg-ink"
                    : "bg-[color-mix(in_srgb,var(--ink)_12%,transparent)] group-hover:bg-[color-mix(in_srgb,var(--ink)_28%,transparent)]"
              }`}
            />
          </Link>
        </li>
      ))}
    </ol>
  );
}
