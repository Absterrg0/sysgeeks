export const SYSTEM_DESIGN_FUNDAMENTALS = [
  {
    question: "What should you clarify first in a system design interview?",
    answer:
      "Identify the users and their core actions, then agree on scale, latency, availability, consistency and durability needs. Prioritize the requirements that change the architecture before drawing components.",
    links: [{ href: "/system-design-interview", label: "Interview approach" }],
  },
  {
    question: "How do you estimate capacity for a system design?",
    answer:
      "Estimate peak requests per second, data written per day, retention and concurrent work from the requirements. Use order-of-magnitude numbers to find likely bottlenecks, then size the parts that need different scaling strategies.",
    links: [{ href: "/capacity-estimator", label: "Capacity estimator" }],
  },
  {
    question: "What is the difference between replication and sharding?",
    answer:
      "Replication keeps copies of the same data on multiple machines, which can improve read capacity and resilience. Sharding splits data across machines to spread storage and write load, but makes cross-shard operations harder.",
    links: [
      { href: "/concepts/replication", label: "Replication" },
      { href: "/concepts/partitioning", label: "Partitioning" },
    ],
  },
  {
    question: "When should you add a cache?",
    answer:
      "Cache data when repeated reads are costly and the hit rate makes the cache faster than recomputing or querying the source. Decide how stale a value may be and how writes invalidate it; caching adds consistency and failure cases.",
    links: [{ href: "/concepts/caching", label: "Caching" }],
  },
  {
    question: "When does a message queue help?",
    answer:
      "A queue decouples a producer from slower consumers and can absorb short bursts, giving workers time to process jobs asynchronously. It does not fix sustained overload: bound the queue, define retry and rejection behavior, and make handlers safe to retry.",
    links: [{ href: "/concepts/message-queues", label: "Message queues" }],
  },
  {
    question: "What does idempotency mean in system design?",
    answer:
      "An idempotent operation has the same effect when the same intent is repeated. Give each intent a stable key, claim it atomically, and reuse it across retries so a timeout does not trigger a second charge or job.",
    links: [{ href: "/concepts/idempotency", label: "Idempotency" }],
  },
  {
    question: "What is the difference between at-least-once and exactly-once delivery?",
    answer:
      "At-least-once delivery retries until acknowledgement, so a message may arrive more than once. Networks cannot guarantee exactly-once delivery; systems make repeated processing harmless with deduplication, idempotency, or conditional state changes.",
    links: [{ href: "/concepts/delivery-guarantees", label: "Delivery guarantees" }],
  },
  {
    question: "How do you stop a stale worker from overwriting a newer result?",
    answer:
      "Give each lease claim a monotonically increasing fencing token and require writes to present the current token. An expired worker may keep running, but storage rejects its stale token after another worker takes ownership.",
    links: [{ href: "/concepts/leases-and-fencing", label: "Leases and fencing tokens" }],
  },
  {
    question: "How can a database migration avoid downtime?",
    answer:
      "Expand the schema compatibly, backfill in bounded batches, capture concurrent writes, and compare old and new data before cutover. Keep the old path available until verification passes and rollback is no longer needed.",
    links: [{ href: "/concepts/online-migrations", label: "Online data migrations" }],
  },
  {
    question: "What is backpressure, and when should a system apply it?",
    answer:
      "Backpressure limits incoming work when a downstream service cannot keep up. Bound queues and slow or reject producers so latency, memory use, and retry volume do not grow without limit.",
    links: [{ href: "/concepts/backpressure", label: "Backpressure and capacity" }],
  },
  {
    question: "What problem does the transactional outbox solve?",
    answer:
      "A database update can commit while publishing its event fails. Write the business change and an outbox record in one transaction, then relay the event with retries and make consumers handle duplicates.",
    links: [{ href: "/concepts/transactional-outbox", label: "Transactional outbox" }],
  },
  {
    question: "How do you handle a hot partition?",
    answer:
      "A single high-volume key can overload one partition even when the rest of the cluster has capacity. Split or salt hot keys, or isolate hot tenants, then account for the extra work needed to merge reads and writes.",
    links: [{ href: "/concepts/partitioning", label: "Partitioning" }],
  },
  {
    question: "How should a payment system handle a timeout with an unknown outcome?",
    answer:
      "Treat the result as unknown rather than failed. Look up the provider operation by its stable reference and reconcile its state before retrying; never create a new charge just because the response timed out.",
    links: [
      { href: "/concepts/reconciliation", label: "Reconciliation" },
      { href: "/concepts/idempotency", label: "Idempotency" },
    ],
  },
  {
    question: "What is load shedding?",
    answer:
      "Load shedding rejects or defers lower-priority work during overload to preserve capacity for critical requests. Pair it with bounded queues and clear retry behavior so rejected work does not create a retry storm.",
    links: [{ href: "/concepts/load-shedding", label: "Load shedding" }],
  },
  {
    question: "When should work run asynchronously?",
    answer:
      "Use asynchronous processing when the caller does not need the result immediately and a durable queue can isolate slow work or smooth bursts. Return an operation status, then design retries, ordering, idempotency, and queue limits explicitly.",
    links: [{ href: "/concepts/asynchronous-processing", label: "Asynchronous processing" }],
  },
] as const;
