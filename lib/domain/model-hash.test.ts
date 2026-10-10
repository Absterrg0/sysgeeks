import { describe, expect, it } from "vitest";
import { modelHash } from "./model-hash";
import type { ProjectModel } from "./project-model";

const base: ProjectModel = {
  components: [
    { id: "app", label: "App", kind: "client", responsibility: "Sends requests." },
    { id: "api", label: "API", kind: "service", responsibility: "Handles requests." },
    { id: "db", label: "Database", kind: "database", responsibility: "Stores orders.", durableState: "orders" },
  ],
  flows: [
    { id: "place", from: "app", to: "api", label: "Place order", kind: "request" },
    { id: "save", from: "api", to: "db", label: "Save order", kind: "data" },
  ],
  invariants: [
    { id: "once", statement: "Each order is saved once", enforcedBy: ["api", "db"], mechanism: "a unique key" },
    { id: "fresh", statement: "Reads are fresh", enforcedBy: ["db"], mechanism: "read-your-writes" },
  ],
};

describe("modelHash", () => {
  it("is eight lowercase hex digits", () => {
    expect(modelHash(base)).toMatch(/^[0-9a-f]{8}$/);
  });

  it("is the same for equal models", () => {
    expect(modelHash(structuredClone(base))).toBe(modelHash(base));
  });

  it("is stable under reordering of components, flows, invariants and enforcers", () => {
    const reordered: ProjectModel = {
      components: [...base.components].reverse(),
      flows: [...base.flows].reverse(),
      invariants: [...base.invariants].reverse().map((inv) => ({ ...inv, enforcedBy: [...inv.enforcedBy].reverse() })),
    };
    expect(modelHash(reordered)).toBe(modelHash(base));
  });

  it("ignores object key order", () => {
    const rekeyed: ProjectModel = {
      ...base,
      components: base.components.map((c) => ({ responsibility: c.responsibility, kind: c.kind, label: c.label, id: c.id, durableState: c.durableState })),
    };
    expect(modelHash(rekeyed)).toBe(modelHash(base));
  });

  it("treats an undefined optional field as absent", () => {
    const withUndefined: ProjectModel = {
      ...base,
      components: base.components.map((c) => ({ ...c, evidence: undefined })),
    };
    expect(modelHash(withUndefined)).toBe(modelHash(base));
  });

  it.each<[string, ProjectModel]>([
    ["a component label", { ...base, components: base.components.map((c) => (c.id === "api" ? { ...c, label: "Gateway" } : c)) }],
    ["a durable state", { ...base, components: base.components.map((c) => (c.id === "db" ? { ...c, durableState: "orders, refunds" } : c)) }],
    ["a flow kind", { ...base, flows: base.flows.map((f) => (f.id === "save" ? { ...f, kind: "async" as const } : f)) }],
    ["an invariant mechanism", { ...base, invariants: base.invariants.map((i) => (i.id === "fresh" ? { ...i, mechanism: "quorum reads" } : i)) }],
    ["an enforcer", { ...base, invariants: base.invariants.map((i) => (i.id === "fresh" ? { ...i, enforcedBy: ["api", "db"] } : i)) }],
    ["a new component", { ...base, components: [...base.components, { id: "cache", label: "Cache", kind: "cache", responsibility: "Warm reads.", durableState: "hot keys" }] }],
    ["a removed flow", { ...base, flows: base.flows.slice(1) }],
  ])("changes when %s changes", (_, edited) => {
    expect(modelHash(edited)).not.toBe(modelHash(base));
  });
});
