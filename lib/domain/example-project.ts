import type { ExampleProject } from "./content";
import type { Project } from "./learner";

/**
 * Copies a curated example into a learner's own project, so practice starts
 * from a real architecture instead of a blank form. Pure: the caller loads the
 * example.
 */
export function instantiateExample(def: ExampleProject, id: string, now: string): Project {
  return {
    id,
    name: def.name,
    summary: def.summary,
    source: { type: "manual" },
    context: def.scale,
    components: def.components,
    flows: def.flows,
    invariants: def.invariants,
    createdAt: now,
    updatedAt: now,
  };
}
