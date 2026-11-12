/** The concepts a model may cite, as the prompts list them. Client-safe: the list itself is fetched (see `loadConceptCatalog`). */
export type ConceptSummary = { id: string; title: string; summary: string };

/** One line per concept: `id: title. summary`. */
export function catalogText(concepts: readonly ConceptSummary[]): string {
  return concepts.map((concept) => `${concept.id}: ${concept.title}. ${concept.summary}`).join("\n");
}

/** Where the build writes the catalog. A static file, so loading it costs the Worker nothing. */
export const CONCEPT_CATALOG_PATH = "/ai/concepts.json";

let cached: Promise<ConceptSummary[]> | null = null;

/** The concept catalog, fetched once per page load from the prerendered JSON. */
export function loadConceptCatalog(): Promise<ConceptSummary[]> {
  cached ??= fetch(CONCEPT_CATALOG_PATH)
    .then((res) => (res.ok ? (res.json() as Promise<{ concepts: ConceptSummary[] }>) : Promise.reject(new Error())))
    .then((json) => json.concepts)
    .catch((error: unknown) => {
      cached = null;
      throw error;
    });
  return cached;
}
