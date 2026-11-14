import "server-only";
import type { ComponentProps } from "react";
import type { Playground } from "@/components/playground/playground";
import { getCompany, getInvestigation, listConcepts, listInvestigations, listWriteups } from "@/lib/content";
import { PLAYGROUNDS } from "@/lib/content/playground";
import { missionsFor } from "@/lib/content/scenarios";

type PlaygroundProps = ComponentProps<typeof Playground>;

/** Everything the playground workspace needs for one system, or undefined when it has none. */
export function playgroundProps(investigationId: string): PlaygroundProps | undefined {
  const inv = getInvestigation(investigationId);
  const workload = PLAYGROUNDS[investigationId];
  if (!inv || !workload) return undefined;

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
  const systems = listInvestigations()
    .filter((i) => PLAYGROUNDS[i.id])
    .map((i) => ({ id: i.id, title: i.title, missions: missionsFor(i.id).length }));

  return {
    investigation: { id: inv.id, title: inv.title, searchTitle: inv.searchTitle },
    system: {
      components: inv.system.components.map((c) => ({
        id: c.id,
        label: c.label,
        kind: c.kind,
        responsibility: c.responsibility,
        position: c.position,
      })),
      flows: inv.system.flows.map((f) => ({ id: f.id, from: f.from, to: f.to, label: f.label, kind: f.kind })),
    },
    workload,
    concepts,
    writeups,
    scenarios: missionsFor(inv.id),
    systems,
  };
}
