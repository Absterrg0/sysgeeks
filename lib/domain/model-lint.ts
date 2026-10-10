/**
 * Deterministic model check (architecture §2.6). Pure, no AI: it runs in the
 * browser and its findings are fed into the review prompt.
 */
import type { ProjectModel } from "./project-model";
import type { ComponentKind } from "./taxonomy";

export type ModelRuleId =
  | "invariant-no-mechanism"
  | "async-no-dedupe"
  | "stateful-no-state"
  | "external-on-request-path"
  | "worker-no-input"
  | "orphan";

export type ModelFinding = {
  ruleId: ModelRuleId;
  severity: "warn" | "info";
  message: string;
  componentIds: string[];
  flowIds: string[];
  conceptIds: string[];
};

const STATEFUL_KINDS: ReadonlySet<ComponentKind> = new Set<ComponentKind>(["database", "queue", "stream", "object-store", "cache"]);
const QUEUE_KINDS: ReadonlySet<ComponentKind> = new Set<ComponentKind>(["queue", "stream"]);
const DEDUPE = /duplicate|idempot|unique|once/i;

/** Rules run in table order over components and flows sorted by id, so input order never changes the output. */
export function lintModel(model: ProjectModel): ModelFinding[] {
  const sorted: ProjectModel = {
    components: byId(model.components),
    flows: byId(model.flows),
    invariants: byId(model.invariants),
  };
  return [
    ...invariantNoMechanism(sorted),
    ...asyncNoDedupe(sorted),
    ...statefulNoState(sorted),
    ...externalOnRequestPath(sorted),
    ...workerNoInput(sorted),
    ...orphan(sorted),
  ];
}

function invariantNoMechanism({ invariants }: ProjectModel): ModelFinding[] {
  return invariants
    .filter((inv) => !inv.mechanism.trim())
    .map((inv): ModelFinding => ({
      ruleId: "invariant-no-mechanism",
      severity: "warn",
      message: `How is "${inv.statement}" enforced?`,
      componentIds: [...inv.enforcedBy].sort(),
      flowIds: [],
      conceptIds: ["concurrency-control"],
    }));
}

function asyncNoDedupe({ flows, invariants }: ProjectModel): ModelFinding[] {
  return flows
    .filter((f) => f.kind === "async")
    .filter((f) => !invariants.some((inv) => inv.enforcedBy.includes(f.to) && DEDUPE.test(`${inv.statement} ${inv.mechanism}`)))
    .map((f): ModelFinding => ({
      ruleId: "async-no-dedupe",
      severity: "warn",
      message: `"${f.label}" can arrive twice; what makes that harmless?`,
      componentIds: [f.to],
      flowIds: [f.id],
      conceptIds: ["delivery-guarantees", "idempotency"],
    }));
}

function statefulNoState({ components }: ProjectModel): ModelFinding[] {
  return components
    .filter((c) => STATEFUL_KINDS.has(c.kind) && !c.durableState?.trim())
    .map((c): ModelFinding => ({
      ruleId: "stateful-no-state",
      severity: "warn",
      message: `Say what ${c.label} keeps.`,
      componentIds: [c.id],
      flowIds: [],
      conceptIds: ["durability"],
    }));
}

type RequestPath = { nodes: string[]; flowIds: string[] };

function externalOnRequestPath({ components, flows }: ProjectModel): ModelFinding[] {
  const requests = flows.filter((f) => f.kind === "request");
  const reported = new Set<string>();
  const findings: ModelFinding[] = [];
  for (const client of components.filter((c) => c.kind === "client")) {
    for (const [id, path] of requestPaths(client.id, requests)) {
      const target = components.find((c) => c.id === id);
      if (target?.kind !== "external" || reported.has(id)) continue;
      reported.add(id);
      findings.push({
        ruleId: "external-on-request-path",
        severity: "warn",
        message: `A slow ${target.label} holds user requests.`,
        componentIds: path.nodes,
        flowIds: path.flowIds,
        conceptIds: ["timeouts", "retries-and-backoff"],
      });
    }
  }
  return findings;
}

/** Shortest chain of request flows from `start`, one entry per reachable component. */
function requestPaths(start: string, requests: ProjectModel["flows"]): Map<string, RequestPath> {
  const paths = new Map<string, RequestPath>([[start, { nodes: [start], flowIds: [] }]]);
  const queue = [start];
  for (const at of queue) {
    const here = paths.get(at);
    if (!here) continue;
    for (const f of requests) {
      if (f.from !== at || paths.has(f.to)) continue;
      paths.set(f.to, { nodes: [...here.nodes, f.to], flowIds: [...here.flowIds, f.id] });
      queue.push(f.to);
    }
  }
  return paths;
}

function workerNoInput({ components, flows }: ProjectModel): ModelFinding[] {
  const queueIds = new Set(components.filter((c) => QUEUE_KINDS.has(c.kind)).map((c) => c.id));
  return components
    .filter((c) => c.kind === "worker" && !flows.some((f) => f.to === c.id && queueIds.has(f.from)))
    .map((c): ModelFinding => ({
      ruleId: "worker-no-input",
      severity: "info",
      message: `What feeds ${c.label}?`,
      componentIds: [c.id],
      flowIds: [],
      conceptIds: ["message-queues"],
    }));
}

function orphan({ components, flows }: ProjectModel): ModelFinding[] {
  return components
    .filter((c) => !flows.some((f) => f.from === c.id || f.to === c.id))
    .map((c): ModelFinding => ({
      ruleId: "orphan",
      severity: "warn",
      message: `${c.label} is not connected.`,
      componentIds: [c.id],
      flowIds: [],
      conceptIds: [],
    }));
}

function byId<T extends { id: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
