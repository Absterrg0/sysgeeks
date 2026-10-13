import type { Metadata } from "next";
import { ExampleGallery } from "@/components/examples/example-gallery";
import { AppHeader } from "@/components/page-header";
import { listExampleProjects } from "@/lib/content/example-projects";
import { itemList, jsonLd, pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata({
  title: "System Design Examples: Real Architectures",
  description:
    "Explore system design examples through components, request flows, scale assumptions and invariants. Copy an architecture and practise changes on your version.",
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
        title="System design examples"
        count={examples.length}
        description={`Explore ${examples.length} system designs through their components, request flows, scale assumptions and invariants. Open one to inspect its architecture, then copy it and practise changes on your version.`}
      />
      <div className="mt-6">
        <ExampleGallery examples={examples} />
      </div>
    </div>
  );
}
