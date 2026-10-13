import type { Metadata } from "next";
import Link from "next/link";
import { ExampleGallery } from "@/components/examples/example-gallery";
import { AppHeader } from "@/components/page-header";
import { listExampleProjects } from "@/lib/content/example-projects";
import { itemList, jsonLd, pageMetadata } from "@/lib/metadata";

const EXAMPLE_COUNT = listExampleProjects().length;

export const metadata: Metadata = pageMetadata({
  title: "System Design Interview Examples",
  description:
    `Explore ${EXAMPLE_COUNT} system design interview examples with diagrams, request flows, component roles and invariants. Original models, not company case studies.`,
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
        title="System design interview examples"
        count={examples.length}
        description={
          <>
            Explore {examples.length} original practice architectures for system design interviews. Trace their
            components, request flows, scale assumptions and invariants. These are illustrative models, not
            reconstructions of a named company&apos;s production system. For source-linked engineering writeups, browse
            our{" "}
            <Link href="/companies" className="link">
              company case studies
            </Link>
            .
          </>
        }
      />
      <div className="mt-6">
        <ExampleGallery examples={examples} />
      </div>
    </div>
  );
}
