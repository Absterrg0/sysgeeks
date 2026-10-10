import { describe, expect, it } from "vitest";
import type { ArchitectureComponent, ArchitectureFlow } from "./content";
import type { ProjectInvariant } from "./learner";
import { lintModel, type ModelRuleId } from "./model-lint";
import type { ProjectModel } from "./project-model";
import type { ComponentKind } from "./taxonomy";

const component = (id: string, kind: ComponentKind, durableState?: string): ArchitectureComponent => ({
  id,
  label: id,
  kind,
  responsibility: "Does its job.",
  ...(durableState ? { durableState } : {}),
});

const flow = (id: string, from: string, to: string, kind: ArchitectureFlow["kind"] = "request"): ArchitectureFlow => ({
  id,
  from,
  to,
  label: id,
  kind,
});

const invariant = (id: string, enforcedBy: string[], statement = "Stock never goes negative", mechanism = "row locks"): ProjectInvariant => ({
  id,
  statement,
  enforcedBy,
  mechanism,
});

const model = (parts: Partial<ProjectModel> = {}): ProjectModel => ({ components: [], flows: [], invariants: [], ...parts });

const fired = (m: ProjectModel, ruleId: ModelRuleId) => lintModel(m).filter((f) => f.ruleId === ruleId);

describe("invariant-no-mechanism", () => {
  it("fires when an invariant names no mechanism", () => {
    const m = model({ components: [component("db", "database", "stock")], invariants: [invariant("i", ["db"], "Stock never goes negative", "  ")] });
    expect(fired(m, "invariant-no-mechanism")).toEqual([
      {
        ruleId: "invariant-no-mechanism",
        severity: "warn",
        message: 'How is "Stock never goes negative" enforced?',
        componentIds: ["db"],
        flowIds: [],
        conceptIds: ["concurrency-control"],
      },
    ]);
  });

  it("stays quiet when the mechanism is named", () => {
    const m = model({ components: [component("db", "database", "stock")], invariants: [invariant("i", ["db"])] });
    expect(fired(m, "invariant-no-mechanism")).toEqual([]);
  });
});

describe("async-no-dedupe", () => {
  const base = (invariants: ProjectInvariant[]) =>
    model({
      components: [component("app", "client"), component("api", "service"), component("worker", "worker")],
      flows: [flow("place", "app", "api"), flow("dispatch", "api", "worker", "async")],
      invariants,
    });

  it("fires when the async target has no dedupe invariant", () => {
    expect(fired(base([]), "async-no-dedupe")).toEqual([
      {
        ruleId: "async-no-dedupe",
        severity: "warn",
        message: '"dispatch" can arrive twice; what makes that harmless?',
        componentIds: ["worker"],
        flowIds: ["dispatch"],
        conceptIds: ["delivery-guarantees", "idempotency"],
      },
    ]);
  });

  it("stays quiet when the target enforces a dedupe invariant", () => {
    expect(fired(base([invariant("i", ["worker"], "Each job runs once", "a dedupe key")]), "async-no-dedupe")).toEqual([]);
  });

  it("fires when the dedupe invariant belongs to some other component", () => {
    expect(fired(base([invariant("i", ["api"], "Orders are unique", "a unique index")]), "async-no-dedupe")).toHaveLength(1);
  });

  it("ignores synchronous flows", () => {
    const m = model({
      components: [component("api", "service"), component("worker", "worker")],
      flows: [flow("dispatch", "api", "worker", "request")],
    });
    expect(fired(m, "async-no-dedupe")).toEqual([]);
  });
});

describe("stateful-no-state", () => {
  it.each(["database", "queue", "stream", "object-store", "cache"] as const)("fires for a %s without durable state", (kind) => {
    const m = model({ components: [component("store", kind)] });
    expect(fired(m, "stateful-no-state")).toEqual([
      {
        ruleId: "stateful-no-state",
        severity: "warn",
        message: "Say what store keeps.",
        componentIds: ["store"],
        flowIds: [],
        conceptIds: ["durability"],
      },
    ]);
  });

  it("stays quiet when durable state is described", () => {
    expect(fired(model({ components: [component("db", "database", "orders")] }), "stateful-no-state")).toEqual([]);
  });

  it("stays quiet for stateless kinds", () => {
    expect(fired(model({ components: [component("api", "service")] }), "stateful-no-state")).toEqual([]);
  });
});

describe("external-on-request-path", () => {
  it("fires when a request chain from a client reaches an external component", () => {
    const m = model({
      components: [component("app", "client"), component("api", "service"), component("pay", "external")],
      flows: [flow("place", "app", "api"), flow("charge", "api", "pay")],
    });
    expect(fired(m, "external-on-request-path")).toEqual([
      {
        ruleId: "external-on-request-path",
        severity: "warn",
        message: "A slow pay holds user requests.",
        componentIds: ["app", "api", "pay"],
        flowIds: ["place", "charge"],
        conceptIds: ["timeouts", "retries-and-backoff"],
      },
    ]);
  });

  it("stays quiet when the external call is asynchronous", () => {
    const m = model({
      components: [component("app", "client"), component("api", "service"), component("pay", "external")],
      flows: [flow("place", "app", "api"), flow("charge", "api", "pay", "async")],
    });
    expect(fired(m, "external-on-request-path")).toEqual([]);
  });

  it("stays quiet when no client starts the chain", () => {
    const m = model({
      components: [component("api", "service"), component("pay", "external")],
      flows: [flow("charge", "api", "pay")],
    });
    expect(fired(m, "external-on-request-path")).toEqual([]);
  });
});

describe("worker-no-input", () => {
  it("fires for a worker that no queue or stream feeds", () => {
    const m = model({ components: [component("w", "worker")] });
    expect(fired(m, "worker-no-input")).toEqual([
      {
        ruleId: "worker-no-input",
        severity: "info",
        message: "What feeds w?",
        componentIds: ["w"],
        flowIds: [],
        conceptIds: ["message-queues"],
      },
    ]);
  });

  it("fires for a worker that only publishes to a queue", () => {
    const m = model({
      components: [component("w", "worker"), component("q", "queue", "jobs")],
      flows: [flow("out", "w", "q", "async")],
    });
    expect(fired(m, "worker-no-input")).toHaveLength(1);
  });

  it.each(["queue", "stream"] as const)("stays quiet when a %s feeds the worker", (kind) => {
    const m = model({
      components: [component("w", "worker"), component("q", kind, "jobs")],
      flows: [flow("in", "q", "w", "async")],
    });
    expect(fired(m, "worker-no-input")).toEqual([]);
  });
});

describe("orphan", () => {
  it("fires for a component with no flows", () => {
    const m = model({ components: [component("lonely", "service")] });
    expect(fired(m, "orphan")).toEqual([
      {
        ruleId: "orphan",
        severity: "warn",
        message: "lonely is not connected.",
        componentIds: ["lonely"],
        flowIds: [],
        conceptIds: [],
      },
    ]);
  });

  it("stays quiet when every component has a flow", () => {
    const m = model({
      components: [component("a", "service"), component("b", "service")],
      flows: [flow("ab", "a", "b", "data")],
    });
    expect(fired(m, "orphan")).toEqual([]);
  });
});

describe("lintModel ordering", () => {
  const messy = model({
    components: [
      component("app", "client"),
      component("api", "service"),
      component("pay", "external"),
      component("db", "database"),
      component("lonely", "service"),
      component("w", "worker"),
    ],
    flows: [flow("place", "app", "api"), flow("charge", "api", "pay"), flow("dispatch", "api", "w", "async")],
    invariants: [invariant("i", ["db"], "Stock never goes negative", "")],
  });

  it("reports rules in table order, with orphans by component id", () => {
    expect(lintModel(messy).map((f) => f.ruleId)).toEqual([
      "invariant-no-mechanism",
      "async-no-dedupe",
      "stateful-no-state",
      "external-on-request-path",
      "worker-no-input",
      "orphan",
      "orphan",
    ]);
    expect(lintModel(messy).filter((f) => f.ruleId === "orphan").map((f) => f.componentIds)).toEqual([["db"], ["lonely"]]);
  });

  it("does not depend on input order", () => {
    const reversed = model({
      components: [...messy.components].reverse(),
      flows: [...messy.flows].reverse(),
      invariants: [...messy.invariants].reverse(),
    });
    expect(lintModel(reversed)).toEqual(lintModel(messy));
  });
});
