import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Playground } from "@/components/playground/playground";
import { getCompany, getInvestigation, listConcepts, listInvestigations, listWriteups } from "@/lib/content";
import { PLAYGROUNDS } from "@/lib/content/playground";
import { breadcrumbs, clip, jsonLd, pageMetadata } from "@/lib/metadata";

export function generateStaticParams() {
  return listInvestigations()
    .filter((inv) => PLAYGROUNDS[inv.id])
    .map((inv) => ({ investigationId: inv.id }));
}

export const dynamicParams = false;

export async function generateMetadata(
  props: PageProps<"/investigations/[investigationId]/playground">,
): Promise<Metadata> {
  const { investigationId } = await props.params;
  const inv = getInvestigation(investigationId);
  if (!inv) return {};
  return pageMetadata({
    title: `${inv.searchTitle}: Architecture Playground`,
    description: clip(
      `Change the architecture of ${inv.title.toLowerCase()}: add caches, queues, load balancers and replicas, turn up the traffic and kill parts, and see what each change buys and costs.`,
    ),
    path: `/investigations/${inv.id}/playground`,
  });
}

export default async function PlaygroundPage(props: PageProps<"/investigations/[investigationId]/playground">) {
  const { investigationId } = await props.params;
  const inv = getInvestigation(investigationId);
  const workload = PLAYGROUNDS[investigationId];
  if (!inv || !workload) notFound();

  // Only what the page shows: concept titles for links, and writeups to point at.
  const concepts = Object.fromEntries(listConcepts().map((c) => [c.id, { title: c.title, summary: c.summary }]));
  const writeups = listWriteups().map((w) => ({
    id: w.id,
    title: w.title,
    url: w.url,
    company: getCompany(w.companyId)?.name ?? w.companyId,
    note: w.note,
    conceptIds: w.conceptIds,
    forThis: w.investigationIds.includes(inv.id),
  }));

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(
            breadcrumbs([
              { name: "System design interview questions", path: "/investigations" },
              { name: inv.searchTitle, path: `/investigations/${inv.id}` },
              { name: "Playground", path: `/investigations/${inv.id}/playground` },
            ]),
          ),
        }}
      />
      <Playground
        investigation={{ id: inv.id, title: inv.title, searchTitle: inv.searchTitle }}
        system={{
          components: inv.system.components.map((c) => ({
            id: c.id,
            label: c.label,
            kind: c.kind,
            responsibility: c.responsibility,
            position: c.position,
          })),
          flows: inv.system.flows.map((f) => ({ id: f.id, from: f.from, to: f.to, label: f.label, kind: f.kind })),
        }}
        workload={workload}
        concepts={concepts}
        writeups={writeups}
      />
    </>
  );
}
