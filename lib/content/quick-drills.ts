export type QuickDrill = {
  id: string;
  topic: string;
  title: string;
  prompt: string;
  choices: { id: string; text: string }[];
  answerId: string;
  reasoning: string;
  tradeoff: string;
  otherChoices: { choiceId: string; whyNot: string }[];
  href: string;
  linkText: string;
};

/** Short, original interview follow-ups; the linked exercises contain the full walkthroughs. */
export const QUICK_DRILLS: QuickDrill[] = [
  {
    id: "payment-timeout",
    topic: "Retries and idempotency",
    title: "The payment provider charged the customer, but your request timed out. What now?",
    prompt: "The customer retries checkout. Pick the safest next step.",
    choices: [
      { id: "new-key", text: "Send a new charge with a new idempotency key." },
      { id: "same-operation", text: "Keep the order pending, then query or retry the same payment using its original idempotency key." },
      { id: "assume-failure", text: "Treat the timeout as a failed charge and let checkout start over." },
    ],
    answerId: "same-operation",
    reasoning:
      "A timeout reports what the caller observed; it does not prove the provider did nothing. A stable key identifies one logical payment across retries. Keep the order pending until the provider confirms the result, then reconcile any outcome that remains uncertain.",
    tradeoff: "The customer may wait for confirmation, but a retry is less likely to charge them twice.",
    otherChoices: [
      { choiceId: "new-key", whyNot: "A new key can create a second logical charge." },
      { choiceId: "assume-failure", whyNot: "The first charge may already have succeeded, so restarting can duplicate it." },
    ],
    href: "/investigations/payment-workflow/diagnose-the-double-charge",
    linkText: "Practise the payment timeout exercise",
  },
  {
    id: "duplicate-message",
    topic: "Queues and delivery guarantees",
    title: "A consumer commits its work, then crashes before acknowledging the message.",
    prompt: "The queue delivers the message again. How do you prevent a duplicate effect?",
    choices: [
      { id: "exactly-once", text: "Configure exactly-once delivery and assume the consumer will only run once." },
      { id: "ack-first", text: "Acknowledge before doing the work so the queue cannot redeliver it." },
      { id: "dedupe", text: "Give the message a stable ID and atomically record it with the state change before acknowledging." },
    ],
    answerId: "dedupe",
    reasoning:
      "Assume a message can be delivered more than once. Store a deduplication record in the same transaction as the consumer's durable state change, then acknowledge. If the effect is external, pass an idempotency key or use an outbox-driven retry; a broker guarantee alone cannot make an arbitrary side effect exactly once.",
    tradeoff: "Deduplication adds retained state and cleanup work, but makes redelivery safe across the commit/acknowledgement gap.",
    otherChoices: [
      { choiceId: "exactly-once", whyNot: "The consumer can still crash between its side effect and acknowledgement." },
      { choiceId: "ack-first", whyNot: "A crash after acknowledgement but before the durable work can lose the message's effect." },
    ],
    href: "/investigations/job-queue",
    linkText: "Practise designing a job queue",
  },
  {
    id: "expired-worker-lease",
    topic: "Worker recovery and fencing",
    title: "A worker's lease expires, but the old worker is still running.",
    prompt: "A replacement worker has taken the job. What prevents the old one from publishing late?",
    choices: [
      { id: "longer-lease", text: "Make the lease longer so it is less likely to expire during normal work." },
      { id: "fence", text: "Give each ownership attempt a newer fencing token and reject writes from an older token." },
      { id: "kill-old", text: "Assume the lease service will stop the old worker when its lease expires." },
    ],
    answerId: "fence",
    reasoning:
      "A lease lets another worker take over after a timeout, but the former owner may be paused or partitioned and later resume. A monotonically increasing fencing token lets the resource reject that stale owner's writes. Persist progress at safe boundaries and make completed steps safe to retry.",
    tradeoff: "The destination must check ownership on writes, and each attempt needs durable progress or idempotent effects.",
    otherChoices: [
      { choiceId: "longer-lease", whyNot: "A longer timeout reduces accidental expiry but delays recovery and does not eliminate stale owners." },
      { choiceId: "kill-old", whyNot: "A lease service cannot reliably terminate a worker across a network partition." },
    ],
    href: "/investigations/video-processing-pipeline/worker-dies-mid-job",
    linkText: "Practise worker failure recovery",
  },
  {
    id: "hot-partition",
    topic: "Hot keys and partitioning",
    title: "One account sends most of the traffic to a single database partition.",
    prompt: "The cluster has spare capacity overall, but that partition is saturated. What do you investigate first?",
    choices: [
      { id: "more-nodes", text: "Add database nodes while keeping the same partition key and routing." },
      { id: "more-pool", text: "Increase every service's database connection pool." },
      { id: "key-shape", text: "Measure load by key, then consider splitting or replicating the hot key based on its read/write pattern." },
    ],
    answerId: "key-shape",
    reasoning:
      "Cluster averages hide a hot key. Measure the skew first. Replicated reads can help a read-heavy key; splitting or salting can spread writes, but may require fan-in, merge work, or per-account ordering. Move an exceptional tenant only if the workload justifies the operational cost.",
    tradeoff: "Distributing one key's load adds coordination or read/merge complexity; the right choice depends on whether reads, writes, or ordering dominate.",
    otherChoices: [
      { choiceId: "more-nodes", whyNot: "More nodes do not help when the same key still routes every request to one partition." },
      { choiceId: "more-pool", whyNot: "More concurrent connections can increase pressure on the already saturated partition." },
    ],
    href: "/investigations/news-feed",
    linkText: "Practise uneven traffic in a news feed",
  },
  {
    id: "cache-stampede",
    topic: "Caching and overload",
    title: "A popular cache entry expires and hundreds of requests miss at once.",
    prompt: "All those requests now try to rebuild the same value from the database. How do you protect the origin?",
    choices: [
      { id: "more-database", text: "Increase database capacity so it can handle the extra reads." },
      { id: "coalesce", text: "Coalesce concurrent fills for the same key, stagger expirations, and bound origin work." },
      { id: "shorter-ttl", text: "Shorten the TTL so expired values are less stale." },
    ],
    answerId: "coalesce",
    reasoning:
      "This is a cache stampede: many misses trigger duplicate work for one value. Let one request refresh the key while concurrent callers wait for or reuse its result. Add TTL jitter or refresh a hot key before expiry, and cap origin concurrency. Serve stale data only when the freshness requirement allows it.",
    tradeoff: "Coalescing and stale-while-revalidate add cache coordination and freshness choices; they reduce duplicate origin work during a burst.",
    otherChoices: [
      { choiceId: "more-database", whyNot: "Capacity may absorb a burst, but it does not prevent repeated work for the same key." },
      { choiceId: "shorter-ttl", whyNot: "Shorter TTLs cause more frequent misses and can make the burst problem worse." },
    ],
    href: "/investigations/distributed-cache",
    linkText: "Practise distributed cache failure modes",
  },
  {
    id: "growing-backlog",
    topic: "Queues and backpressure",
    title: "A job queue grows every hour even though every worker is busy.",
    prompt: "What would you check before adding more workers?",
    choices: [
      { id: "depth-only", text: "Watch queue depth; if it is high, keep adding consumers until it falls." },
      { id: "oldest-age", text: "Track arrival rate and oldest-message age, then check whether the downstream system can take more work." },
      { id: "retry-fast", text: "Retry failed messages immediately so they do not hold up the queue." },
    ],
    answerId: "oldest-age",
    reasoning:
      "Compare arrival and completion rates and track how old the oldest job is; depth alone does not show how long users wait. Add consumers only if the bottleneck can accept the extra load. Otherwise slow or reject producers, shed optional work, or make each job cheaper, then define how the backlog drains.",
    tradeoff: "Backpressure protects downstream systems but can delay or reject work, so the product needs an explicit overload policy.",
    otherChoices: [
      { choiceId: "depth-only", whyNot: "Extra consumers can overload a database or dependency and grow the backlog somewhere else." },
      { choiceId: "retry-fast", whyNot: "Immediate retries add load precisely when the system is already falling behind." },
    ],
    href: "/concepts/backpressure",
    linkText: "Review backpressure and overload control",
  },
  {
    id: "async-replica-failover",
    topic: "Replication and durability",
    title: "The primary acknowledged a write, then failed before an asynchronous replica received it.",
    prompt: "The team promotes the replica. What guarantee can you claim?",
    choices: [
      { id: "no-loss", text: "No acknowledged writes are lost because the replica is now primary." },
      { id: "define-rpo", text: "State the recovery-point objective: asynchronous replication can lose recent acknowledged writes; synchronous acknowledgement trades latency for a stronger durability promise." },
      { id: "retry-all", text: "Tell every client to retry all writes against the new primary." },
    ],
    answerId: "define-rpo",
    reasoning:
      "An asynchronous replica may lag when the primary fails. Be explicit about the acceptable recovery point objective and what an acknowledgement promises. Synchronous replication can strengthen the durability of acknowledged writes, at additional latency and availability cost. Client retries also need stable operation IDs to avoid duplicate effects.",
    tradeoff: "A stronger replication acknowledgement costs latency and can reduce write availability when the replica or network is unavailable.",
    otherChoices: [
      { choiceId: "no-loss", whyNot: "Promotion cannot restore a write that had not reached the replica." },
      { choiceId: "retry-all", whyNot: "A retry cannot know whether the first write committed; it needs an idempotency key or state check." },
    ],
    href: "/concepts/replication",
    linkText: "Review replication and failover guarantees",
  },
  {
    id: "live-migration",
    topic: "Data migration and correctness",
    title: "A backfill copies a database while users keep writing to the old one.",
    prompt: "How do you avoid missing writes when you switch reads to the new database?",
    choices: [
      { id: "snapshot-switch", text: "Copy a snapshot, then immediately switch all reads to the new database." },
      { id: "dual-write-only", text: "Start dual writes and assume both databases stay in sync." },
      { id: "capture-verify", text: "Capture changes during the backfill, replay them, compare critical invariants, then switch gradually with a rollback point." },
    ],
    answerId: "capture-verify",
    reasoning:
      "A snapshot misses writes that arrive while it is copied. Capture changes before or during the backfill, replay until caught up, and verify counts plus business invariants. Switch reads gradually only after parity is good, keep the old path available for rollback, and retire it after the new path is proven.",
    tradeoff: "Change capture and verification add temporary operational complexity, but they expose drift before the new database becomes authoritative.",
    otherChoices: [
      { choiceId: "snapshot-switch", whyNot: "Writes made after the snapshot can be absent from the new database at cutover." },
      { choiceId: "dual-write-only", whyNot: "A partial failure can update one database but not the other; dual writes need retry, reconciliation, and a cutover plan." },
    ],
    href: "/investigations/shard-live-database",
    linkText: "Practise a safe live database migration",
  },
];
