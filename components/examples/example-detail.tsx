import Link from "next/link";
import { ExampleExplorer } from "@/components/examples/example-explorer";
import { CATEGORY_LABELS } from "@/components/examples/example-gallery";
import { PracticeButton } from "@/components/examples/practise-button";
import { PageHeader } from "@/components/page-header";
import { getConcept, getInvestigation } from "@/lib/content";
import type { ExampleProject } from "@/lib/domain/content";
import { autoLayout } from "@/lib/domain/layout";

export function ExampleDetail({ example }: { example: ExampleProject }) {
  const placed = autoLayout(example.components, example.flows);
  const concepts = example.focusConceptIds.flatMap((id) => {
    const c = getConcept(id);
    return c ? [c] : [];
  });
  const investigations = example.relatedInvestigationIds.flatMap((id) => {
    const inv = getInvestigation(id);
    return inv ? [inv] : [];
  });

  return (
    <div>
      <PageHeader
        eyebrow={
          <>
            <Link href="/projects/examples" className="hover:text-ink">
              Examples
            </Link>
            <span className="mx-1.5 text-rule-strong">/</span>
            {CATEGORY_LABELS[example.category]}
          </>
        }
        title={example.name}
        meta={`Scale: ${example.scale}`}
        actions={<PracticeButton example={example} />}
      >
        {example.summary}
      </PageHeader>

      <div className="pt-8 pb-16">
        <ExampleExplorer
          name={example.name}
          components={placed}
          flows={example.flows}
          invariants={example.invariants}
          rail={
            <aside className="space-y-8" aria-label="Learn more">
              <RailList
                id="concepts"
                title="Concepts it exercises"
                items={concepts.map((c) => ({ href: `/concepts/${c.id}`, title: c.title, text: c.summary }))}
              />
              {investigations.length > 0 && (
                <RailList
                  id="related"
                  title="Related systems"
                  items={investigations.map((inv) => ({
                    href: `/investigations/${inv.id}`,
                    title: inv.title,
                    text: inv.premise,
                  }))}
                />
              )}
            </aside>
          }
        />
      </div>
    </div>
  );
}

function RailList({ id, title, items }: { id: string; title: string; items: { href: string; title: string; text: string }[] }) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="mb-2.5 flex items-baseline gap-2 text-[0.8125rem] font-semibold">
        {title} <span className="font-mono text-[0.6875rem] font-normal text-ink-3">{items.length}</span>
      </h2>
      <ul className="sheet overflow-hidden">
        {items.map((item) => (
          <li key={item.href} className="sheet-row">
            <Link
              href={item.href}
              className="group block px-4 py-3 transition-colors hover:bg-[color-mix(in_srgb,var(--hover)_70%,transparent)]"
            >
              <span className="flex items-center justify-between gap-3 text-[0.8125rem] font-medium text-ink">
                {item.title}
                <span aria-hidden="true" className="text-ink-3 transition-transform group-hover:translate-x-0.5">
                  →
                </span>
              </span>
              <span className="mt-0.5 line-clamp-2 block text-[0.75rem] leading-relaxed text-ink-3">{item.text}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
