/**
 * What a change in the playground did, in words: what it bought, what it costs, and what can now go
 * wrong, each tied to the concepts behind it so the page can point at the engineering writeups that
 * discuss them. Derived from the simulation, so every number is the one on screen.
 */
import { ROLES, simulate, tune, type PlayModel, type Simulation, type Workload } from "./playground";

export type InsightTone = "gain" | "cost" | "risk" | "info";

export type Insight = {
  id: string;
  tone: InsightTone;
  title: string;
  detail: string;
  conceptIds: string[];
  /** The parts it is about, for highlighting. */
  componentIds: string[];
};

/** "3,860/s", "1.2M/s", "40/min", "2,000/day": per second when there is at least one a second. */
export function formatRate(perSecond: number): string {
  const n = Math.max(0, perSecond);
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M/s`;
  if (n >= 1e4) return `${Math.round(n / 1e3)}k/s`;
  if (n >= 10) return `${Math.round(n).toLocaleString("en-US")}/s`;
  if (n >= 1) return `${n.toFixed(1)}/s`;
  if (n * 60 >= 1) return `${Math.round(n * 60)}/min`;
  if (n * 3600 >= 1) return `${Math.round(n * 3600)}/h`;
  return `${Math.round(n * 86400).toLocaleString("en-US")}/day`;
}

export const percent = (share: number) => `${Math.round(share * 100)}%`;

export function formatLatency(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`;
}

/** "99.95%": as many decimals as it takes to show the nines. */
export function formatAvailability(share: number): string {
  if (share >= 0.99999) return "99.999%";
  if (share <= 0) return "0%";
  const nines = Math.min(3, Math.max(1, Math.floor(-Math.log10(1 - share)) - 1));
  return `${(share * 100).toFixed(nines)}%`;
}

export function playInsights(input: {
  model: PlayModel;
  sim: Simulation;
  reference: PlayModel;
  referenceSim: Simulation;
  workload: Workload;
  traffic: number;
}): { changes: Insight[]; now: Insight[] } {
  const { model, sim, reference, referenceSim, workload, traffic } = input;
  const byId = new Map(model.components.map((c) => [c.id, c]));
  const refById = new Map(reference.components.map((c) => [c.id, c]));
  const name = (id: string) => byId.get(id)?.label ?? refById.get(id)?.label ?? id;
  const load = (s: Simulation, id: string) => (s.components[id]?.reads ?? 0) + (s.components[id]?.writes ?? 0);
  const util = (s: Simulation, id: string) => s.components[id]?.utilization ?? 0;
  const opsThrough = (s: Simulation, id: string) => s.operations.filter((o) => o.route.slice(1).includes(id));
  const list = (labels: string[]) =>
    labels.length <= 1 ? (labels[0] ?? "") : `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
  const changes: Insight[] = [];
  const now: Insight[] = [];

  // Parts put in front of something.
  for (const part of model.components.filter((c) => c.added)) {
    const onward = model.flows.find((f) => f.from === part.id && f.added)?.to;
    if (!onward) continue;
    const target = name(onward);
    const t = model.tuning[part.id];
    const ids = [part.id, onward];
    switch (part.role) {
      case "cache": {
        changes.push({
          id: `${part.id}-gain`,
          tone: "gain",
          title: `${target} gets ${formatRate(load(sim, onward))} instead of ${formatRate(load(referenceSim, onward))}`,
          detail: `The cache answers ${percent(t?.hitRate ?? 0)} of reads, so ${target} runs at ${percent(util(sim, onward))} instead of ${percent(util(referenceSim, onward))}.`,
          conceptIds: ["caching"],
          componentIds: ids,
        });
        changes.push({
          id: `${part.id}-stale`,
          tone: "cost",
          title: "Reads can now be stale",
          detail: `After a write, readers can see the old value until the entry is invalidated or expires. Decide which reads can live with that, and how ${target} tells the cache.`,
          conceptIds: ["caching"],
          componentIds: ids,
        });
        const cold = simulate(tune(model, part.id, { hitRate: 0 }), workload, traffic);
        const coldUtil = util(cold, onward);
        changes.push({
          id: `${part.id}-cold`,
          tone: coldUtil >= 1 ? "risk" : "info",
          title: coldUtil >= 1 ? `An empty cache would sink ${target}` : `${target} survives an empty cache`,
          detail: `If the cache restarts empty, every read goes to ${target} at once: it would run at ${percent(coldUtil)}. ${
            coldUtil >= 1
              ? "Warm it gradually, and let one request refill a key while the rest wait."
              : "There is room for that at this traffic."
          }`,
          conceptIds: ["request-coalescing", "caching"],
          componentIds: ids,
        });
        break;
      }
      case "cdn": {
        changes.push({
          id: `${part.id}-gain`,
          tone: "gain",
          title: `The edge answers ${percent(t?.hitRate ?? 0)} of cacheable requests`,
          detail: `${target} gets ${formatRate(load(sim, onward))} instead of ${formatRate(load(referenceSim, onward))}, and those answers come from near the user.`,
          conceptIds: ["caching"],
          componentIds: ids,
        });
        changes.push({
          id: `${part.id}-purge`,
          tone: "cost",
          title: "Changes take a purge or a TTL to show",
          detail:
            "Anything the edge has cached stays there until it expires or you purge it. Deletes and edits need a plan for that.",
          conceptIds: ["caching"],
          componentIds: ids,
        });
        break;
      }
      case "lb": {
        const instances = model.tuning[onward]?.instances ?? 1;
        changes.push(
          instances > 1
            ? {
                id: `${part.id}-gain`,
                tone: "gain",
                title: `${target} can lose an instance and keep serving`,
                detail: `Requests spread across ${instances} instances; when one dies, health checks take it out and the rest carry on.`,
                conceptIds: ["timeouts"],
                componentIds: ids,
              }
            : {
                id: `${part.id}-alone`,
                tone: "info",
                title: `One instance behind it: nothing to balance yet`,
                detail: `Give ${target} more than one instance. Until then the load balancer only adds a hop.`,
                conceptIds: [],
                componentIds: ids,
              },
        );
        changes.push({
          id: `${part.id}-cost`,
          tone: "cost",
          title: "One more hop, and health checks to tune",
          detail:
            "Every request pays for the extra hop, and how fast a dead instance stops getting traffic depends on the health-check interval and timeout.",
          conceptIds: ["timeouts"],
          componentIds: ids,
        });
        break;
      }
      case "queue": {
        const faster = sim.operations.filter((o) => {
          const before = referenceSim.operations.find((r) => r.id === o.id);
          return o.handoff !== undefined && before && before.handoff === undefined && !o.background;
        });
        for (const o of faster) {
          const before = referenceSim.operations.find((r) => r.id === o.id);
          changes.push({
            id: `${part.id}-${o.id}-fast`,
            tone: "gain",
            title: `${o.label} return in ${formatLatency(o.latencyMs)} instead of ${formatLatency(before?.latencyMs ?? 0)}`,
            detail: `Callers stop waiting once the work is queued; ${target} does it afterwards, at its own pace, and a burst waits in the queue instead of failing.`,
            conceptIds: ["asynchronous-processing", "message-queues"],
            componentIds: ids,
          });
        }
        changes.push({
          id: `${part.id}-dupes`,
          tone: "cost",
          title: `${target} will see some work twice`,
          detail: `Queues deliver at least once: after a crash or a timeout, a message comes back. ${target}'s work has to be safe to repeat, and the caller only knows it was accepted, not done.`,
          conceptIds: ["delivery-guarantees", "idempotency"],
          componentIds: ids,
        });
        break;
      }
      case "limiter": {
        const rejected = sim.components[part.id]?.rejected ?? 0;
        changes.push({
          id: `${part.id}-gain`,
          tone: "gain",
          title: `${target} is held to ${formatRate(t?.limit ?? 0)}`,
          detail: `It runs at ${percent(util(sim, onward))} instead of ${percent(util(referenceSim, onward))}: whatever is over the limit is turned away before it costs anything.`,
          conceptIds: ["rate-limiting", "load-shedding"],
          componentIds: ids,
        });
        changes.push({
          id: `${part.id}-rejected`,
          tone: rejected > 0 ? "cost" : "info",
          title:
            rejected > 0 ? `${formatRate(rejected)} rejected at this traffic` : "Nothing is rejected at this traffic",
          detail:
            "Rejected requests get 429 Too Many Requests. Limit per client key rather than globally, or one noisy client uses up everyone's share.",
          conceptIds: ["rate-limiting"],
          componentIds: ids,
        });
        break;
      }
    }
  }

  // Sizing changed on parts of the reference design.
  for (const c of model.components.filter((c) => !c.added)) {
    const t = model.tuning[c.id];
    const r = reference.tuning[c.id];
    if (!t || !r) continue;
    if (c.role === "database") {
      if (t.replicas > r.replicas) {
        changes.push({
          id: `${c.id}-replicas`,
          tone: "cost",
          title: `${c.label}'s replicas lag behind its primary`,
          detail: `${t.replicas} read replica${t.replicas === 1 ? "" : "s"} per primary take reads off it (${percent(util(sim, c.id))} busy, was ${percent(util(referenceSim, c.id))}), but a read just after a write can miss it. Send reads that must see their own writes to the primary.`,
          conceptIds: ["replication"],
          componentIds: [c.id],
        });
      }
      if (t.instances > r.instances) {
        changes.push({
          id: `${c.id}-shards`,
          tone: "cost",
          title: `${c.label} is split into ${t.instances} shards`,
          detail: `Each primary takes a share of the writes (${percent(util(sim, c.id))} busy, was ${percent(util(referenceSim, c.id))}). Queries that span shards have to ask all of them, and moving data between shards later is hard, so the shard key matters.`,
          conceptIds: ["partitioning", "consistent-hashing"],
          componentIds: [c.id],
        });
      }
      continue;
    }
    if (t.instances !== r.instances && !ROLES[c.role].managed) {
      const more = t.instances > r.instances;
      changes.push({
        id: `${c.id}-instances`,
        tone: more ? "gain" : "cost",
        title: `${c.label}: ${t.instances} instance${t.instances === 1 ? "" : "s"} instead of ${r.instances}`,
        detail: `It runs at ${percent(util(sim, c.id))} instead of ${percent(util(referenceSim, c.id))}. ${
          more
            ? "More instances cost more, and only help if something spreads requests across them."
            : "Fewer instances cost less and leave less room for a burst."
        }`,
        conceptIds: ["backpressure"],
        componentIds: [c.id],
      });
      const spread = opsThrough(sim, c.id).every((o) => {
        const at = o.route.indexOf(c.id);
        return (
          at <= 1 ||
          o.route.slice(0, at).some((id) => ["lb", "cdn", "limiter", "queue"].includes(byId.get(id)?.role ?? ""))
        );
      });
      if (more && c.role === "service" && !spread) {
        changes.push({
          id: `${c.id}-no-lb`,
          tone: "info",
          title: `Callers need a way to reach every ${c.label} instance`,
          detail: "Put a load balancer in front, or use client-side balancing, so new instances actually get traffic.",
          conceptIds: [],
          componentIds: [c.id],
        });
      }
    }
  }

  // Parts of the reference design that were taken out.
  for (const c of reference.components.filter((c) => !byId.has(c.id))) {
    const broken = sim.operations.filter((o) => !o.reachable && o.blockedBy === c.id).map((o) => o.label);
    changes.push({
      id: `${c.id}-removed`,
      tone: broken.length > 0 ? "risk" : "info",
      title: broken.length > 0 ? `Without ${c.label}, ${list(broken)} cannot happen` : `${c.label} removed`,
      detail: c.responsibility,
      conceptIds: [],
      componentIds: [],
    });
  }

  // What this traffic does to the design as it stands.
  for (const c of model.components) {
    const r = sim.components[c.id];
    const t = model.tuning[c.id];
    if (!r || !t) continue;
    const ops = opsThrough(sim, c.id);
    if (r.status === "down") {
      const broken = sim.operations.filter((o) => !o.reachable && o.blockedBy === c.id).map((o) => o.label);
      now.push({
        id: `${c.id}-down`,
        tone: "risk",
        title: `${c.label} is down`,
        detail:
          c.role === "cache"
            ? "Every read it used to answer now falls through to what it fronts."
            : broken.length > 0
              ? `${list(broken)} fail until it is back.`
              : "Nothing depends on it right now.",
        conceptIds: ["replication"],
        componentIds: [c.id],
      });
    } else if (t.down > 0) {
      now.push({
        id: `${c.id}-survived`,
        tone: "gain",
        title: `${c.label} lost ${t.down} of ${t.instances} instances and kept serving`,
        detail: `The rest run at ${percent(r.utilization)}.`,
        conceptIds: ["replication"],
        componentIds: [c.id],
      });
    }
    if (r.status === "over") {
      const waited = ops.filter(
        (o) => !o.background && (o.handoff === undefined || o.route.indexOf(c.id) <= o.handoff),
      );
      const turnedAway = (r.reads + r.writes) * (1 - 1 / r.utilization);
      now.push({
        id: `${c.id}-over`,
        tone: "risk",
        title: `${c.label} is at ${percent(r.utilization)}`,
        detail:
          waited.length > 0
            ? `About ${formatRate(turnedAway)} more arrives than it can handle, so requests queue up and time out. Add instances, take load off it, or turn work away early.`
            : `It falls behind: a backlog of about ${formatRate(ops.reduce((sum, o) => sum + o.backlog, 0))} builds up and has to be worked off later.`,
        conceptIds: waited.length > 0 ? ["backpressure", "load-shedding"] : ["backpressure", "message-queues"],
        componentIds: [c.id],
      });
    }
    if (r.spof && r.status !== "down") {
      const waited = ops.filter((o) => !o.background).map((o) => o.label);
      if (waited.length > 0) {
        now.push({
          id: `${c.id}-spof`,
          tone: "risk",
          title: `${c.label} is a single point of failure`,
          detail: `${list(waited)} stop if its one instance does. Kill it to see.`,
          conceptIds: ["replication"],
          componentIds: [c.id],
        });
      }
    }
  }
  const rank: Record<InsightTone, number> = { risk: 0, cost: 1, gain: 2, info: 3 };
  now.sort((a, b) => rank[a.tone] - rank[b.tone]);
  return { changes, now };
}
