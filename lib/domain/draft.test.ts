import { describe, expect, it } from "vitest";
import type { IntakeDraft } from "../ai/schemas";
import { getExampleProject } from "@/lib/content/example-projects";
import type { ExampleProject } from "./content";
import { draftToProject, normalizeDraft } from "./draft";
import { modelOf, modelProblems } from "./project-model";

type DraftComponent = IntakeDraft["components"][number];
type DraftFlow = IntakeDraft["flows"][number];
type DraftInvariant = IntakeDraft["invariants"][number];

const AT = "2026-01-01T00:00:00.000Z";
const why = "Because the description says so.";

function component(id: string, extra: Partial<DraftComponent> = {}): DraftComponent {
  return { id, label: id, kind: "service", responsibility: `Handles ${id}.`, confidence: "stated", why, ...extra };
}

function flow(id: string, from: string, to: string, extra: Partial<DraftFlow> = {}): DraftFlow {
  return { id, from, to, label: `${from} to ${to}`, kind: "request", confidence: "stated", why, ...extra };
}

function invariant(id: string, enforcedBy: string[], extra: Partial<DraftInvariant> = {}): DraftInvariant {
  return { id, statement: `${id} holds`, enforcedBy, mechanism: "Checked on write.", confidence: "stated", why, ...extra };
}

function draftOf(parts: Partial<IntakeDraft> = {}): IntakeDraft {
  return {
    name: "Shop",
    summary: "A shop.",
    components: [component("web", { kind: "client" }), component("api")],
    flows: [flow("browse", "web", "api")],
    invariants: [],
    openQuestions: [],
    ...parts,
  };
}

/** The authored example, as the model would have described it, with confidence. */
function asDraft(example: ExampleProject): IntakeDraft {
  return {
    name: example.name,
    summary: example.summary,
    components: example.components.map((c) => ({ ...c, confidence: "stated" as const, why })),
    flows: example.flows.map((f) => ({ ...f, confidence: "stated" as const, why })),
    invariants: example.invariants.map((i) => ({ ...i, confidence: "stated" as const, why })),
    openQuestions: [],
  };
}

const source = { type: "description" as const, draftedAt: AT };

describe("normalizeDraft", () => {
  it.each(["subscription-saas", "storefront"])(
    "an authored example converted to a draft survives normalization unchanged (%s)",
    (id) => {
      const draft = asDraft(getExampleProject(id)!);
      expect(normalizeDraft(draft)).toEqual({ draft, dropped: [] });
    },
  );

  it("drops flows with missing endpoints, self-loops or no label, and says so", () => {
    const { draft, dropped } = normalizeDraft(
      draftOf({
        flows: [
          flow("browse", "web", "api"),
          flow("ghost", "web", "nowhere"),
          flow("loop", "api", "api"),
          flow("blank", "web", "api", { label: " " }),
        ],
      }),
    );
    expect(draft.flows.map((f) => f.id)).toEqual(["browse"]);
    expect(dropped).toEqual([
      'Dropped flow "web to nowhere": one of its components is not in the model.',
      'Dropped flow "api to api": it starts and ends at the same component.',
      'Dropped flow "blank": it needs a label.',
    ]);
  });

  it("drops components without a name or responsibility, and the flows that used them", () => {
    const { draft, dropped } = normalizeDraft(
      draftOf({
        components: [component("web", { kind: "client" }), component("api"), component("blank", { label: " " })],
        flows: [flow("browse", "web", "api"), flow("save", "web", "blank")],
      }),
    );
    expect(draft.components.map((c) => c.id)).toEqual(["web", "api"]);
    expect(draft.flows.map((f) => f.id)).toEqual(["browse"]);
    expect(dropped).toEqual([
      'Dropped component "blank": it needs a name and a responsibility.',
      'Dropped flow "web to blank": one of its components is not in the model.',
    ]);
  });

  it("removes enforcing components that do not exist, and drops invariants left with none", () => {
    const { draft, dropped } = normalizeDraft(
      draftOf({
        invariants: [invariant("paid-once", ["api", "nowhere"]), invariant("orphan", ["nowhere"])],
      }),
    );
    expect(draft.invariants.map((i) => [i.id, i.enforcedBy])).toEqual([["paid-once", ["api"]]]);
    expect(dropped).toEqual([
      'Removed "nowhere" from "paid-once holds": no such component.',
      'Removed "nowhere" from "orphan holds": no such component.',
      'Dropped invariant "orphan holds": no component enforces it.',
    ]);
  });

  it("re-slugifies and dedupes ids, and rewrites references to match", () => {
    const { draft, dropped } = normalizeDraft(
      draftOf({
        components: [component("API Gateway", { label: "Gateway" }), component("api-gateway"), component("db")],
        flows: [flow("Call", "API Gateway", "db"), flow("call", "db", "api-gateway")],
        invariants: [invariant("Pays once", ["API Gateway"])],
      }),
    );
    expect(draft.components.map((c) => c.id)).toEqual(["api-gateway", "api-gateway-2", "db"]);
    expect(draft.flows.map((f) => [f.id, f.from, f.to])).toEqual([
      ["call", "api-gateway", "db"],
      ["call-2", "db", "api-gateway"],
    ]);
    expect(draft.invariants.map((i) => [i.id, i.enforcedBy])).toEqual([["pays-once", ["api-gateway"]]]);
    expect(dropped).toEqual([]);
  });

  it("drops evidence outside the allowed paths when they are given", () => {
    const draft = draftOf({
      components: [component("api", { evidence: [{ path: "src/api.ts" }, { path: "gone.ts", startLine: 3 }] })],
      flows: [],
    });
    const result = normalizeDraft(draft, { allowedPaths: new Set(["src/api.ts"]) });
    expect(result.draft.components[0]?.evidence).toEqual([{ path: "src/api.ts" }]);
    expect(result.dropped).toEqual(['Dropped evidence "gone.ts" from component "api": not a file in the repository.']);
  });

  it("leaves evidence alone when no allowed paths are given", () => {
    const draft = draftOf({ components: [component("api", { evidence: [{ path: "gone.ts" }] })], flows: [] });
    expect(normalizeDraft(draft).draft.components[0]?.evidence).toEqual([{ path: "gone.ts" }]);
  });

  it("always leaves a model the editor accepts", () => {
    const messy = draftOf({
      components: [component("api", { label: "" }), component("api"), component("db")],
      flows: [flow("a", "api", "db"), flow("b", "db", "gone")],
      invariants: [invariant("x", ["api", "gone"]), invariant("y", ["db"], { statement: " " })],
    });
    const project = draftToProject(normalizeDraft(messy).draft, { id: "shop", now: AT, source });
    expect(modelProblems(modelOf(project))).toEqual([]);
  });
});

describe("draftToProject", () => {
  it("converts an authored example's draft back to its authored model", () => {
    const example = getExampleProject("subscription-saas")!;
    const project = draftToProject(asDraft(example), { id: "copy", now: AT, source, context: example.scale });
    expect(project).toMatchObject({ id: "copy", name: example.name, summary: example.summary, context: example.scale });
    expect(project.components).toEqual(example.components);
    expect(project.flows).toEqual(example.flows);
    expect(project.invariants).toEqual(example.invariants);
    expect(project.createdAt).toBe(AT);
    expect(project.updatedAt).toBe(AT);
  });

  it("strips confidence and reasons, and keeps evidence", () => {
    const draft = draftOf({
      components: [component("api", { evidence: [{ path: "src/api.ts", startLine: 4 }] })],
      flows: [],
    });
    const project = draftToProject(draft, { id: "shop", now: AT, source });
    expect(project.components[0]).not.toHaveProperty("confidence");
    expect(project.components[0]).not.toHaveProperty("why");
    expect(project.components[0]?.evidence).toEqual([{ path: "src/api.ts", startLine: 4 }]);
  });

  it("keeps only the chosen items, and prunes what depended on the rest", () => {
    const draft = draftOf({
      components: [component("web", { kind: "client" }), component("api"), component("db", { kind: "database" })],
      flows: [flow("browse", "web", "api"), flow("store", "api", "db")],
      invariants: [invariant("paid-once", ["db", "api"]), invariant("solo", ["db"])],
    });
    const project = draftToProject(draft, {
      id: "shop",
      now: AT,
      source,
      keep: { components: ["web", "api"] },
    });
    expect(project.components.map((c) => c.id)).toEqual(["web", "api"]);
    expect(project.flows.map((f) => f.id)).toEqual(["browse"]);
    expect(project.invariants.map((i) => [i.id, i.enforcedBy])).toEqual([["paid-once", ["api"]]]);
    expect(modelProblems(modelOf(project))).toEqual([]);
  });
});
