/**
 * A content hash of a project's architecture model. Reordering components,
 * flows, invariants or enforcers does not change it; any edit does.
 */
import type { ProjectModel } from "./project-model";

export function modelHash(model: ProjectModel): string {
  return fnv1a(
    stableStringify({
      components: byId(model.components),
      flows: byId(model.flows),
      invariants: byId(model.invariants).map((inv) => ({ ...inv, enforcedBy: [...inv.enforcedBy].sort() })),
    }),
  );
}

/** JSON with keys sorted and undefined values dropped, so key order and absent optionals don't matter. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function byId<T extends { id: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
