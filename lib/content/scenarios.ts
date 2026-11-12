import type { Scenario } from "@/lib/domain/scenarios";

/**
 * Situations to get each system through in its playground. Numbers come from the system's workload
 * (`playground.ts`); a surge says what the situation sends more of. Every scenario starts failing and has an
 * answer that passes: `scenarios.test.ts` checks both, so a change to the model that breaks one shows up.
 *
 * `realWorld` says only what the cited writeups say. What the model cannot show goes in `limits`.
 */
export const SCENARIOS: Scenario[] = [
  // -------------------------------------------------------------------------
  // URL shortener
  // -------------------------------------------------------------------------
  {
    id: "campaign-launch",
    investigationId: "url-shortener",
    title: "A campaign lands",
    summary: "Redirects at four times the usual peak, on a budget.",
    situation:
      "A customer's links go out in a push notification to tens of millions of phones. For an hour redirects run at four times the usual peak, spread over thousands of links. Keep redirects and new links working without more than doubling what you pay for. Click counts may lag: nobody waits on them.",
    traffic: 5,
    surge: { redirect: 4, clicks: 4 },
    frozen: [
      {
        componentId: "cdn",
        field: "hitRate",
        why: "How much the edge answers depends on which links people click, not on a setting.",
      },
    ],
    goals: [
      { kind: "served", ops: ["redirect", "create"], maxFailing: 0.001 },
      { kind: "budget", maxInstances: 16 },
    ],
    hints: [
      { text: "Two parts are over capacity. One of them every redirect that misses the edge has to pass through." },
      {
        text: "Redirect service needs more instances. Postgres serves redirects' reads: a replica adds room for reads without touching how writes work.",
        componentIds: ["redirect", "db"],
      },
    ],
    debrief: {
      cost: "You pay for the extra instances and the replica all month to get through an hour. Reads from a replica can be a moment behind the primary, which redirects can live with: a link is created once and read many times, and an edited link showing its old target for a second is harmless.",
      realWorld:
        "Dub's redirect path looks a link up in Redis and falls back to the database, and records the click after the response has gone, so a burst of clicks never slows a redirect. When people wanted to filter and group clicks, the click data moved to a store built for analytics.",
      sourceIds: ["dub-link-middleware", "dub-click-analytics"],
      conceptIds: ["caching", "replication", "asynchronous-processing"],
      interview:
        "Redirects are a read-heavy hot path, so I scale the read side (edge, stateless redirect instances, read replicas) and keep everything that is not the redirect, like counting clicks, off it and asynchronous.",
      limits:
        "The edge's hit rate is fixed here. Really it depends on how many distinct links are hot and how long responses may be cached, and a redirect you must count on every click often cannot be cached at the edge at all.",
    },
    solution: [
      { tune: "redirect", set: { instances: 8 } },
      { tune: "db", set: { replicas: 1 } },
    ],
  },
  {
    id: "edge-purge",
    investigationId: "url-shortener",
    title: "The edge forgets everything",
    summary: "Survive a full CDN purge at peak.",
    situation:
      "A bad deploy purges the CDN at the evening peak. For a few minutes every redirect goes to your origin, about seven times what it normally sees. Keep the system up through it, with no more than one redirect in a hundred failing, on a budget.",
    traffic: 5,
    frozen: [
      {
        componentId: "cdn",
        field: "hitRate",
        why: "How much the edge answers depends on which links people click, not on a setting.",
      },
    ],
    goals: [
      { kind: "served", ops: ["redirect", "create"], maxFailing: 0.001 },
      { kind: "served", ops: ["redirect"], maxFailing: 0.01, when: { kind: "cold", componentId: "cdn" } },
      { kind: "budget", maxInstances: 18 },
    ],
    hints: [
      {
        text: "Turn the edge off in your head: everything it answered now reaches the redirect service and Postgres. Which of them runs out first?",
      },
      {
        text: "Redirect service needs room for the whole peak. For Postgres, either add room for reads or put something in front of it that holds the popular links: when the edge is empty, a cache behind it gets the hits the edge used to take.",
        componentIds: ["redirect", "db"],
      },
    ],
    debrief: {
      cost: "Origin capacity for a cold edge sits idle almost all the time. Plenty of teams decide a few minutes of errors once a year is cheaper, and shed load with a fast 503 and Retry-After while the edge refills instead. Either way it is a decision, not an accident.",
      realWorld:
        "Facebook's memcache paper treats an empty cache as a hazard to the databases behind it: a new cache cluster fills itself from a warm cluster's caches rather than the databases, and leases make sure only one request for a missing key goes to the database while the rest wait. Dub's redirect code shows the plainer version: when Redis cannot answer, it falls back to the database.",
      sourceIds: ["meta-scaling-memcache", "dub-link-middleware"],
      conceptIds: ["caching", "request-coalescing", "load-shedding"],
      interview:
        "Every cache is a capacity dependency: if it empties, the origin sees the full load. I either size the origin for a cold cache, or plan how it warms up and coalesce misses so the origin never sees the stampede.",
      limits:
        "Here the edge goes from full to empty at once and stays empty. A real cache refills in seconds to minutes, and the dangerous part is the stampede of identical misses in the first moments, which this model does not show.",
    },
    solution: [
      { tune: "redirect", set: { instances: 10 } },
      { insert: "cache", before: "db", set: { hitRate: 0.9 } },
    ],
  },

  // -------------------------------------------------------------------------
  // News feed
  // -------------------------------------------------------------------------
  {
    id: "match-night",
    investigationId: "news-feed",
    title: "Everyone refreshes at once",
    summary: "Timeline reads at 1.4× the usual peak.",
    situation:
      "A final goes to extra time and everyone keeps refreshing. Timeline reads run at 1.4 times the usual peak. Every timeline read fetches the posts it lists, so the post store takes the same surge. Keep timelines working without adding more than 70 instances.",
    traffic: 2.4,
    surge: { timeline: 1.4, hydrate: 1.4 },
    goals: [
      { kind: "served", ops: ["timeline", "hydrate", "post"], maxFailing: 0.001 },
      { kind: "wait", op: "hydrate", maxMs: 30 },
      { kind: "budget", maxInstances: 965 },
    ],
    hints: [
      { text: "The timeline cache holds lists of post ids, not posts. Where do the posts come from?" },
      {
        text: "Post lookups hit the post store for every post on every timeline, and the same popular posts are fetched over and over. Something in front of the post store could answer those. Timeline API needs a little more room too.",
        componentIds: ["posts", "timeline-api"],
      },
    ],
    debrief: {
      cost: "A post cache has to forget a post the moment it is deleted or edited, and deletes are not optional. The cache also needs room for every post that is popular right now, which on a night like this is a lot of posts.",
      realWorld:
        "In the talk on Twitter's timelines, a home timeline is a list of tweet ids kept in a cache and written on fan-out; reading one means fetching the tweets for those ids. Timelines are treated as rebuildable from the source data, which is why losing that cache is survivable.",
      sourceIds: ["twitter-timelines-at-scale"],
      conceptIds: ["caching", "fan-out", "soft-state"],
      interview:
        "I keep ids in the timeline and fetch the posts through a cache: timelines stay small and rebuildable, and a popular post lives in memory once instead of being copied into millions of timelines.",
      limits:
        "Reads here are spread evenly. Real traffic on a night like this is skewed: a handful of posts are in nearly every timeline, which helps a post cache, and a handful of accounts post constantly, which hurts fan-out.",
    },
    solution: [
      { insert: "cache", before: "posts", set: { hitRate: 0.9, instances: 5 } },
      { tune: "timeline-api", set: { instances: 260 } },
    ],
  },

  // -------------------------------------------------------------------------
  // Payments
  // -------------------------------------------------------------------------
  {
    id: "slow-provider",
    investigationId: "payment-workflow",
    title: "The provider slows to a crawl",
    summary: "Charges take 12 seconds during a launch.",
    situation:
      "During a launch your payment provider is degraded: every charge takes about eight times longer, around 12 seconds. You cannot make the provider faster. Keep buyers from waiting more than half a second for checkout to answer, without losing any charges.",
    traffic: 14,
    faults: [{ kind: "slow", componentId: "provider", factor: 8 }],
    goals: [
      { kind: "wait", op: "charge", maxMs: 500 },
      { kind: "served", ops: ["checkout", "charge"], maxFailing: 0 },
    ],
    hints: [
      { text: "The buyer waits for the charge because the API calls the provider while the buyer is waiting." },
      {
        text: "What if the API only had to record that a charge is owed, and something else made the call?",
        componentIds: ["api", "provider"],
      },
    ],
    debrief: {
      cost: "The buyer no longer learns the result when they click: checkout says the payment is processing, and you owe them an answer later, by webhook and email. The worker that makes the call will sometimes retry it, so every charge needs an idempotency key or a retry after a timeout can charge twice.",
      realWorld:
        "Stripe's payments API was rebuilt around payment methods that confirm later: a payment became an explicit state machine whose result can arrive asynchronously and is reported by webhook. Idempotency keys are how Stripe makes it safe to retry a request whose outcome you did not see.",
      sourceIds: ["stripe-payments-apis", "stripe-idempotency"],
      conceptIds: ["asynchronous-processing", "idempotency", "state-machines", "webhooks"],
      interview:
        "When a dependency is slow and I cannot make it faster, I stop making the user wait on it: accept the order, charge asynchronously with an idempotency key, and move the payment through explicit states that webhooks advance.",
      limits:
        "The model does not count the API's threads held open while it waits on the provider. A real synchronous design runs out of those long before the provider's quota, so it fails sooner than shown here.",
    },
    solution: [{ insert: "queue", before: "provider" }],
  },
  {
    id: "primary-dies",
    investigationId: "payment-workflow",
    title: "The database primary dies",
    summary: "Lose the Postgres primary without failing checkouts.",
    situation:
      "At peak the machine running Postgres dies. Checkouts and incoming webhooks must keep working through it, and you can add at most one machine.",
    traffic: 14,
    goals: [
      { kind: "served", ops: ["checkout", "webhooks"], maxFailing: 0 },
      {
        kind: "served",
        ops: ["checkout", "webhooks"],
        maxFailing: 0.01,
        when: { kind: "kill", componentId: "postgres", count: "one" },
      },
      { kind: "budget", maxInstances: 8 },
    ],
    hints: [
      { text: "More shards would not help: each shard would still be the only copy of its data." },
      {
        text: "Postgres needs a second copy of the same data that can take over.",
        componentIds: ["postgres"],
      },
    ],
    debrief: {
      cost: "A standby doubles the database bill. Failover is not instant: for tens of seconds writes fail and clients must retry. With asynchronous replication the last writes the old primary accepted can be lost, so payment systems often replicate synchronously to the standby and pay a little latency on every commit.",
      realWorld:
        "Brandur Leach's write-up of Stripe-style idempotency keys builds each request out of database transactions with recovery points, so a client can retry after a failure (a failover included) and the request picks up where it stopped instead of charging again.",
      sourceIds: ["brandur-idempotency-keys", "stripe-idempotency"],
      conceptIds: ["replication", "idempotency", "transactions"],
      interview:
        "Shards spread load; replicas survive failures. For a payment ledger I want a synchronous standby so a failover cannot lose a committed charge, and idempotency keys so clients can retry straight through the failover.",
      limits:
        "Here a replica takes over instantly and nothing in flight is lost. In practice detection and promotion take seconds to a minute, and what is lost depends on how replication was configured.",
    },
    solution: [{ tune: "postgres", set: { replicas: 1 } }],
  },

  // -------------------------------------------------------------------------
  // Sharding a live database
  // -------------------------------------------------------------------------
  {
    id: "shard-dies",
    investigationId: "shard-live-database",
    title: "One shard's machine dies",
    summary: "Eight shards, no replicas, one dead machine.",
    situation:
      "The data is split across eight shards, each on its own machine. At peak one of those machines dies. Reads and writes must keep working, with at most one in a thousand failing.",
    traffic: 2,
    goals: [
      { kind: "served", ops: ["reads", "writes"], maxFailing: 0 },
      {
        kind: "served",
        ops: ["reads", "writes"],
        maxFailing: 0.001,
        when: { kind: "kill", componentId: "shards", count: "one" },
      },
      { kind: "budget", maxInstances: 56 },
    ],
    hints: [
      { text: "Kill one shard and look at what fails: is it everyone a little, or some people completely?" },
      {
        text: "Adding shards spreads the data thinner, but every shard is still the only copy of its slice. Each one needs something that can take its place.",
        componentIds: ["shards"],
      },
    ],
    debrief: {
      cost: "Twice the database machines. And the more machines you run, the more often one of them is failing somewhere: at eight shards a once-a-year machine failure happens about every six weeks, at thirty-two about every eleven days.",
      realWorld:
        "Notion created far more logical shards than machines, so that capacity could later be added by moving whole shards to new hosts. When they did need three times the capacity, they moved shards using replication and switched each over with a brief pause.",
      sourceIds: ["notion-sharding-postgres", "notion-great-reshard"],
      conceptIds: ["replication", "partitioning"],
      interview:
        "Sharding multiplies the machines that can fail, and a dead shard takes its slice of users down completely. So every shard gets its own replica and automated failover, and I can say what a failover loses.",
      limits:
        "A replica here takes over at once and loses nothing. The model also spreads keys evenly, so it cannot show a hot shard.",
    },
    solution: [{ tune: "shards", set: { replicas: 1 } }],
  },
  {
    id: "traffic-triples",
    investigationId: "shard-live-database",
    title: "Traffic triples",
    summary: "Grow to three times the average without new failures.",
    situation:
      "A year of growth: traffic is now three times what the design was sized for. Keep reads, writes and the writes still going to the old database working, with writes answered within 200 ms on average, while paying for at most 70 instances.",
    traffic: 3,
    goals: [
      { kind: "served", ops: ["reads", "writes", "legacy"], maxFailing: 0.001 },
      { kind: "wait", op: "writes", maxMs: 200 },
      { kind: "budget", maxInstances: 70 },
    ],
    hints: [
      { text: "Several parts are short of room, not just one. Look at what is over or near capacity." },
      {
        text: "The app tier is over capacity, and the shards and the connection poolers are close to it.",
        componentIds: ["app", "shards", "poolers"],
      },
    ],
    debrief: {
      cost: "In the playground a new shard is a number. In production it is a migration: copy the data, keep copying changes, check old and new agree, then switch, one shard at a time and without losing a write.",
      realWorld:
        "Two years after first sharding, Notion's shards were running hot. Because they had created many logical shards up front, they could triple the number of machines by moving whole logical shards to new hosts with replication, instead of re-splitting the data.",
      sourceIds: ["notion-great-reshard", "notion-sharding-postgres"],
      conceptIds: ["partitioning", "online-migrations", "replication"],
      interview:
        "I shard into many more logical shards than machines, so growth means moving shards rather than re-hashing rows. Then capacity is an operational task, not a redesign.",
      limits:
        "Adding a shard here takes effect at once and moves no data. The model does not show the copy, the double writes or the cut-over, which are where the risk is.",
    },
    solution: [
      { tune: "app", set: { instances: 45 } },
      { tune: "shards", set: { instances: 12 } },
      { tune: "poolers", set: { instances: 6 } },
    ],
  },

  // -------------------------------------------------------------------------
  // Product analytics
  // -------------------------------------------------------------------------
  {
    id: "double-send",
    investigationId: "product-analytics",
    title: "An SDK bug doubles every event",
    summary: "Twice the events at peak; never drop one.",
    situation:
      "A bad SDK release makes every customer's app send each event twice, at peak. Customers' apps must never have an event turned away, and ingestion has to keep up rather than fall further behind every minute. You can add at most 60 instances.",
    traffic: 4,
    surge: { capture: 2 },
    goals: [
      { kind: "served", ops: ["capture"], maxFailing: 0 },
      { kind: "keeps-up", ops: ["capture"] },
      { kind: "budget", maxInstances: 229 },
    ],
    hints: [
      { text: "Two separate things break: the front door turns events away, and the work behind the stream falls behind." },
      {
        text: "The capture endpoint needs more instances, and the ingestion workers behind the stream need more to keep up.",
        componentIds: ["capture", "ingest"],
      },
    ],
    debrief: {
      cost: "While ingestion catches up, dashboards are minutes behind, and the stream needs enough retention to hold the whole spike. The duplicates are now stored too: deduplicate on an event id, or every count is doubled for that hour.",
      realWorld:
        "PostHog's events reach ClickHouse through Kafka rather than as direct inserts, so a spike or a database outage becomes lag that is worked off later instead of events turned away.",
      sourceIds: ["posthog-clickhouse"],
      conceptIds: ["message-queues", "backpressure", "idempotency"],
      interview:
        "Capture has one job: accept the event and put it on a durable log fast. Everything after that can lag; the lag is a number on a dashboard, not lost data.",
      limits:
        "The stream here never fills up. A real one has finite retention, so a long enough outage behind it still loses events.",
    },
    solution: [
      { tune: "capture", set: { instances: 2 } },
      { tune: "ingest", set: { instances: 200 } },
    ],
  },
];

export function scenariosFor(investigationId: string): Scenario[] {
  return SCENARIOS.filter((s) => s.investigationId === investigationId);
}
