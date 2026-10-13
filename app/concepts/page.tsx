import type { Metadata } from "next";
import { ConceptBrowser, type BrowserConcept } from "@/components/concepts/concept-browser";
import { conceptsByDomain, listConcepts, stagesUsingConcept } from "@/lib/content";
import { CONCEPT_DOMAINS, DOMAIN_LABELS } from "@/lib/domain/content";
import { itemList, jsonLd, pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata({
  title: "35 System Design Concepts with Examples",
  description:
    "Explore 35 system design concepts through concise lessons, interactive checks, and worked examples of caching, replication, queues, and failure handling.",
  path: "/concepts",
});

export default function ConceptsPage() {
  const groups = conceptsByDomain();
  const domains = CONCEPT_DOMAINS.filter((d) => (groups.get(d) ?? []).length > 0);
  const concepts: BrowserConcept[] = domains.flatMap((domain) =>
    (groups.get(domain) ?? []).map((c) => {
      const uses = stagesUsingConcept(c.id);
      const systems = [...new Map(uses.map((u) => [u.investigation.id, u.investigation.title])).entries()];
      return {
        id: c.id,
        title: c.title,
        summary: c.summary,
        domain,
        checks: (c.lesson ?? []).filter((step) => step.kind !== "read" && step.kind !== "simulation").length,
        claims: c.claims.length,
        systems: systems.map(([id, title]) => ({ id, title })),
        stages: uses.length,
      };
    }),
  );
  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(
            itemList(
              "System design concepts",
              listConcepts().map((c) => ({ name: c.title, path: `/concepts/${c.id}` })),
            ),
          ),
        }}
      />
      <ConceptBrowser concepts={concepts} domains={domains.map((d) => ({ id: d, label: DOMAIN_LABELS[d] }))} />
    </div>
  );
}
