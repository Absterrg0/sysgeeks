import type { Metadata } from "next";
import { ExampleGallery } from "@/components/examples/example-gallery";
import { AppHeader } from "@/components/page-header";
import { listExampleProjects } from "@/lib/content/example-projects";
import { itemList, jsonLd, pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata({
  title: "System Design Examples: Real Architectures",
  description:
    "Real system designs, drawn as components, flows and invariants. Study one, then copy it and practise on your copy.",
  path: "/projects/examples",
});

export default function ExamplesPage() {
  const examples = listExampleProjects();
  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(
            itemList(
              "System design examples",
              examples.map((e) => ({ name: e.name.replace(/\s*\(example\)$/, ""), path: `/projects/examples/${e.id}` })),
            ),
          ),
        }}
      />
      <AppHeader
        title="Example architectures"
        count={examples.length}
        description="Whole systems: their parts, how they talk, and what must stay true. Study one, then copy it and practise on your version."
      />
      <div className="mt-6">
        <ExampleGallery examples={examples} />
      </div>
    </div>
  );
}
