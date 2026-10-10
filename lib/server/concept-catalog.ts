import "server-only";
import { listConcepts } from "@/lib/content";

export type ConceptSummary = { id: string; title: string; summary: string };

export function conceptCatalog(): ConceptSummary[] {
  return listConcepts().map(({ id, title, summary }) => ({ id, title, summary }));
}

export function catalogText(): string {
  return conceptCatalog()
    .map((concept) => `${concept.id}: ${concept.title}. ${concept.summary}`)
    .join("\n");
}
