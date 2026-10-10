import Link from "next/link";
import { CategoryFilter } from "@/components/examples/category-filter";
import { SystemThumb } from "@/components/system-thumb";
import { EXAMPLE_CATEGORIES, type ExampleProject } from "@/lib/domain/content";
import { autoLayout } from "@/lib/domain/layout";

export const CATEGORY_LABELS: Record<ExampleProject["category"], string> = {
  saas: "SaaS",
  marketplace: "Marketplace",
  realtime: "Realtime",
  commerce: "Commerce",
  ml: "ML serving",
  iot: "IoT",
  mobility: "Mobility",
  content: "Content",
  gaming: "Gaming",
  fintech: "Fintech",
  ticketing: "Ticketing",
  devtools: "Developer tools",
};

function ExampleCard({ example }: { example: ExampleProject }) {
  const placed = autoLayout(example.components, example.flows);
  return (
    <Link href={`/projects/examples/${example.id}`} className="sheet group flex h-full flex-col overflow-hidden">
      <div className="dotgrid flex h-32 items-center justify-center border-b border-rule-soft px-6 py-4">
        <SystemThumb
          components={placed}
          flows={example.flows}
          given={new Set(example.components.map((c) => c.id))}
          className="max-h-full"
        />
      </div>
      <div className="flex flex-1 flex-col px-4 pt-3 pb-3.5">
        <h3 className="truncate text-[0.875rem] font-medium transition-colors group-hover:text-accent">
          {example.name.replace(/ \(example\)$/, "")}
        </h3>
        <p className="mt-0.5 line-clamp-2 text-[0.75rem] leading-snug text-ink-3">{example.scale}</p>
        <p className="mt-auto flex items-center justify-between pt-3 text-[0.75rem] text-ink-3">
          <span className="chip-flat">{CATEGORY_LABELS[example.category]}</span>
          <span>{example.components.length} parts</span>
        </p>
      </div>
    </Link>
  );
}

/** Server-rendered: only the cards cross to the client, never the example definitions. */
export function ExampleGallery({
  examples,
  title,
  aside,
}: {
  examples: ExampleProject[];
  title?: string;
  aside?: string;
}) {
  const categories = EXAMPLE_CATEGORIES.filter((c) => examples.some((e) => e.category === c)).map((c) => ({
    id: c,
    label: CATEGORY_LABELS[c],
  }));
  const items = examples.map((example) => ({
    id: example.id,
    category: example.category,
    card: <ExampleCard example={example} />,
  }));
  return <CategoryFilter title={title} categories={categories} items={items} aside={aside} />;
}
