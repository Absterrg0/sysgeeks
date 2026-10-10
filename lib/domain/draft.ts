/**
 * Intake drafts: what the AI proposes from a description or repository, made
 * into a model the editor accepts. Pure and client-safe, so the schema types
 * are type-only imports.
 */
import type { IntakeDraft } from "../ai/schemas";
import type { ArchitectureComponent, ArchitectureFlow } from "./content";
import type { Project, ProjectInvariant } from "./learner";
import { slugify, uniqueSlug } from "./layout";

type DraftComponent = IntakeDraft["components"][number];
type DraftFlow = IntakeDraft["flows"][number];
type DraftInvariant = IntakeDraft["invariants"][number];
type CodeRef = NonNullable<DraftComponent["evidence"]>[number];

export type DraftKeep = { components?: string[]; flows?: string[]; invariants?: string[] };

/**
 * Repairs a draft so that it passes `modelProblems`: ids are slugs and unique,
 * and every reference resolves. What cannot be repaired is dropped, and each
 * drop is described in `dropped` for the review UI.
 */
export function normalizeDraft(
  draft: IntakeDraft,
  opts: { allowedPaths?: ReadonlySet<string> } = {},
): { draft: IntakeDraft; dropped: string[] } {
  const dropped: string[] = [];
  const allowed = opts.allowedPaths;

  const components: DraftComponent[] = [];
  const componentIds = new Map<string, string>();
  const takenComponents = new Set<string>();
  for (const component of draft.components) {
    if (!component.label.trim() || !component.responsibility.trim()) {
      dropped.push(`Dropped component "${component.label.trim() || component.id}": it needs a name and a responsibility.`);
      continue;
    }
    const id = uniqueSlug(component.id, takenComponents);
    takenComponents.add(id);
    if (!componentIds.has(slugify(component.id))) componentIds.set(slugify(component.id), id);
    components.push(checkEvidence({ ...component, id }, `component "${component.label}"`, allowed, dropped));
  }
  const resolve = (ref: string) => componentIds.get(slugify(ref));

  const flows: DraftFlow[] = [];
  const takenFlows = new Set<string>();
  for (const flow of draft.flows) {
    const from = resolve(flow.from);
    const to = resolve(flow.to);
    if (!flow.label.trim()) {
      dropped.push(`Dropped flow "${flow.id}": it needs a label.`);
    } else if (!from || !to) {
      dropped.push(`Dropped flow "${flow.label}": one of its components is not in the model.`);
    } else if (from === to) {
      dropped.push(`Dropped flow "${flow.label}": it starts and ends at the same component.`);
    } else {
      const id = uniqueSlug(flow.id, takenFlows);
      takenFlows.add(id);
      flows.push({ ...flow, id, from, to });
    }
  }

  const invariants: DraftInvariant[] = [];
  const takenInvariants = new Set<string>();
  for (const invariant of draft.invariants) {
    if (!invariant.statement.trim()) {
      dropped.push(`Dropped invariant "${invariant.id}": it needs a statement.`);
      continue;
    }
    const enforcedBy: string[] = [];
    for (const ref of invariant.enforcedBy) {
      const id = resolve(ref);
      if (!id) dropped.push(`Removed "${ref}" from "${invariant.statement}": no such component.`);
      else if (!enforcedBy.includes(id)) enforcedBy.push(id);
    }
    if (enforcedBy.length === 0) {
      dropped.push(`Dropped invariant "${invariant.statement}": no component enforces it.`);
      continue;
    }
    const id = uniqueSlug(invariant.id, takenInvariants);
    takenInvariants.add(id);
    invariants.push(checkEvidence({ ...invariant, id, enforcedBy }, `invariant "${invariant.statement}"`, allowed, dropped));
  }

  return { draft: { ...draft, components, flows, invariants }, dropped };
}

function checkEvidence<T extends { evidence?: CodeRef[] }>(
  item: T,
  owner: string,
  allowed: ReadonlySet<string> | undefined,
  dropped: string[],
): T {
  if (!allowed || !item.evidence) return item;
  const evidence = item.evidence.filter((ref) => {
    if (allowed.has(ref.path)) return true;
    dropped.push(`Dropped evidence "${ref.path}" from ${owner}: not a file in the repository.`);
    return false;
  });
  return { ...item, evidence };
}

/**
 * Turns a draft into a stored project. The `keep` lists choose which items
 * the person kept in the review; references to removed items are then pruned
 * as in `normalizeDraft`. Confidence and reasons stay in the draft.
 */
export function draftToProject(
  draft: IntakeDraft,
  opts: { id: string; now: string; source: Project["source"]; context?: string; keep?: DraftKeep },
): Project {
  const { keep } = opts;
  const { draft: model } = normalizeDraft({
    ...draft,
    components: draft.components.filter((c) => !keep?.components || keep.components.includes(c.id)),
    flows: draft.flows.filter((f) => !keep?.flows || keep.flows.includes(f.id)),
    invariants: draft.invariants.filter((i) => !keep?.invariants || keep.invariants.includes(i.id)),
  });
  return {
    id: opts.id,
    name: draft.name,
    summary: draft.summary,
    source: opts.source,
    context: opts.context,
    components: model.components.map(
      ({ id, label, kind, responsibility, durableState, evidence }): ArchitectureComponent => ({
        id,
        label,
        kind,
        responsibility,
        durableState,
        evidence,
      }),
    ),
    flows: model.flows.map(
      ({ id, from, to, label, kind }): ArchitectureFlow => ({ id, from, to, label, kind }),
    ),
    invariants: model.invariants.map(
      ({ id, statement, enforcedBy, mechanism, evidence }): ProjectInvariant => ({
        id,
        statement,
        enforcedBy,
        mechanism,
        evidence,
      }),
    ),
    createdAt: opts.now,
    updatedAt: opts.now,
  };
}
