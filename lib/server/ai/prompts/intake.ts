import "server-only";
import type { IntakeDraft } from "@/lib/ai/schemas";
import { getExampleProject } from "@/lib/content/example-projects";
import { COMPONENT_KINDS, type ComponentKind, FLOW_KINDS, type FlowKind } from "@/lib/domain/taxonomy";
import { INJECTION_GUARD, type UntrustedDocument, wrapUntrusted } from "@/lib/server/ai/untrusted";

const COMPONENT_GUIDE: Record<ComponentKind, string> = {
  client: "client (Client): a user-facing program such as a web app, mobile app or CLI.",
  edge: "edge (Edge / gateway): the entry point that receives traffic first, such as a load balancer, CDN or API gateway.",
  service: "service (Service): a server process that handles requests and holds business logic.",
  worker: "worker (Worker): a background process that consumes jobs, runs schedules or processes events.",
  database: "database (Database): a store of records that must survive restarts.",
  queue: "queue (Queue): a buffer of pending jobs or messages between producers and consumers.",
  "object-store": "object-store (Object storage): blob storage for files and other large binary objects.",
  cache: "cache (Cache): a fast, disposable copy of data that reduces load on the source of truth.",
  stream: "stream (Log / stream): an ordered, replayable log of events that several consumers can read.",
  external: "external (External service): a third-party product or SaaS that the system calls but does not run.",
};

const FLOW_GUIDE: Record<FlowKind, string> = {
  request: "request: the caller waits for the answer.",
  async: "async: the caller does not wait; the work is queued, scheduled or triggered later.",
  data: "data: bulk transfer of bytes or records, such as uploads, downloads, replication or exports.",
  push: "push: the server sends data to the client without a request.",
};

const RULES = [
  "Include only components the input evidences. Do not add typical parts it never mentions.",
  "Mark external SaaS and third-party products as kind external.",
  "Point every request flow from the caller to the callee.",
  'Set confidence to "stated" when the input says it, "inferred" when code or configuration implies it, and "guessed" when it is typical for this kind of system but unseen.',
  "Leave mechanism empty rather than invent one.",
  "Put what the input leaves unknown in openQuestions.",
  "Use at most 16 components, 30 flows and 8 invariants.",
  "Ids are unique lowercase kebab-case slugs of at most 40 characters. Flows and invariants reference component ids only.",
  "For repositories, cite evidence only with file paths from the documents or the listing. Keep each why to one line.",
];

const STATED = { confidence: "stated", why: "Stated in the example description." } as const;

/** The Subscription SaaS example, rendered as the draft the model should return. */
function intakeExample(): IntakeDraft {
  const example = getExampleProject("subscription-saas");
  if (!example) throw new Error('Missing the "subscription-saas" example.');
  return {
    name: example.name,
    summary: example.summary,
    components: example.components.map(
      (c): IntakeDraft["components"][number] => ({
        id: c.id,
        label: c.label,
        kind: c.kind,
        responsibility: c.responsibility,
        durableState: c.durableState,
        ...STATED,
      }),
    ),
    flows: example.flows.map(
      (f): IntakeDraft["flows"][number] => ({ id: f.id, from: f.from, to: f.to, label: f.label, kind: f.kind, ...STATED }),
    ),
    invariants: example.invariants.map(
      (i): IntakeDraft["invariants"][number] => ({
        id: i.id,
        statement: i.statement,
        enforcedBy: i.enforcedBy,
        mechanism: i.mechanism,
        ...STATED,
      }),
    ),
    openQuestions: ["How are failed background jobs retried, and when do they give up?"],
  };
}

export function intakeInstructions(): string {
  return [
    "You draft the architecture model of a software system from the documents a learner gives you. The model is a map of components, the flows between them, and the invariants they keep true.",
    INJECTION_GUARD,
    "Vocabulary. Use these terms exactly.",
    "Component kinds:",
    ...COMPONENT_KINDS.map((kind) => `- ${COMPONENT_GUIDE[kind]}`),
    "Flow kinds:",
    ...FLOW_KINDS.map((kind) => `- ${FLOW_GUIDE[kind]}`),
    "Invariant: a property that must always hold. Describe the mechanism that keeps it true, not the technology.",
    "Rules:",
    ...RULES.map((rule) => `- ${rule}`),
    "Output fields: name, summary (one or two sentences), components (id, label, kind, responsibility, optional durableState, confidence, why, optional evidence), flows (id, from, to, label, kind, confidence, why), invariants (id, statement, enforcedBy, mechanism, confidence, why, optional evidence), openQuestions.",
    "Example output for a Subscription SaaS system:",
    JSON.stringify(intakeExample()),
  ].join("\n");
}

export type IntakePromptInput = {
  name?: string;
  context?: string;
  documents: UntrustedDocument[];
  listing?: string[];
};

export function intakePrompt(input: IntakePromptInput): string {
  const untrusted: UntrustedDocument[] = [
    ...(input.name ? [{ source: "name", text: input.name }] : []),
    ...(input.context ? [{ source: "context", text: input.context }] : []),
    ...(input.listing?.length ? [{ source: "repo:listing", text: input.listing.join("\n") }] : []),
    ...input.documents,
  ];
  return [
    'Draft the model for the project below. Sources: "name" and "context" are the author\'s words; "repo:listing" lists the repository\'s file paths; other sources are documents. Ground every item in these sources.',
    wrapUntrusted(untrusted),
  ].join("\n\n");
}
