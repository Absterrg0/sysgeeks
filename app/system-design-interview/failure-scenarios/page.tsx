import type { Metadata } from "next";
import Link from "next/link";
import { ContentUsefulness } from "@/components/content-usefulness";
import { PageHeader, Section } from "@/components/page-header";
import { PracticeEntryLink } from "@/components/practice-entry-link";
import { breadcrumbs, faqPage, jsonLd, pageMetadata } from "@/lib/metadata";
import { SITE_URL } from "@/lib/site";

const PATH = "/system-design-interview/failure-scenarios";
const TITLE = "System Design Interview Follow-Up Questions: 12 Scenarios";
const DESCRIPTION =
  "Practise 12 system design interview follow-up questions about failures, overload, and recovery, with worked answers, a five-step method, and free interactive drills.";

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

const FAQ = [
  {
    question: "How should I answer a failure scenario in a system design interview?",
    answer:
      "Start with the user-visible symptom and the guarantee that must still hold. Trace the failure boundary, explain how it is detected and contained, then describe recovery and how you verify the system is correct afterward. State the cost or weaker guarantee your recovery choice introduces.",
  },
  {
    question: "What failure scenarios should I practise for system design interviews?",
    answer:
      "Practise uncertain payment timeouts, duplicate queue delivery, workers stopping mid-job, database failover, stale caches, hot partitions, growing backlogs, cache stampedes, slow dependencies, out-of-order events, split-brain writes, and data migrations. They test guarantees around idempotency, durable progress, availability, freshness, load distribution, ordering, and safe recovery.",
  },
  {
    question: "What follow-up questions come after the first system design diagram?",
    answer:
      "Expect the interviewer to change a constraint or introduce a failure: traffic grows tenfold, a hot key overloads one partition, a dependency slows down, a queue falls behind, a cache entry expires under heavy load, or a region becomes unreachable. Explain what the user sees, which guarantee must hold, how you detect and recover, and what trade-off the change introduces.",
  },
  {
    question: "Should I retry whenever a system design request fails?",
    answer:
      "No. First decide whether the operation may already have succeeded. Retry only when the operation is safe to repeat or protected by an idempotency mechanism, and use a deadline, bounded attempts, and backoff. Otherwise check the authoritative state or reconcile the uncertain outcome.",
  },
  {
    question: "Do interviewers expect one exact failure-handling design?",
    answer:
      "Usually the useful signal is the reasoning, not one memorized architecture. State the required guarantee, compare an appropriate recovery choice with an alternative, and explain what changes if the interviewer changes the consistency, cost, or availability requirement.",
  },
];

const SCENARIOS = [
  {
    title: "The payment succeeded, but the caller timed out",
    failure: "The provider may have charged the customer even though your service never received the response.",
    answer:
      "Do not issue a fresh charge just because the first response is missing. Retry with the same idempotency key, query the provider by that key where supported, and reconcile outcomes that remain uncertain. Keep the order pending until the payment state is known.",
    cue: "The retry must identify the same logical payment, not create a second one.",
    href: "/investigations/payment-workflow/diagnose-the-double-charge",
    link: "Practise the double-charge failure",
  },
  {
    title: "A worker dies halfway through a job",
    failure: "The job may be retried while the old worker is still running or after it has already produced an output.",
    answer:
      "Make progress durable at safe boundaries, let a lease expire so another worker can take over, and attach a fencing token or attempt version to writes. Publish the result only if the worker still owns the current attempt; make repeating completed steps harmless.",
    cue: "A lease says who may work now; fencing prevents an expired owner from publishing late.",
    href: "/investigations/video-processing-pipeline/worker-dies-mid-job",
    link: "Practise worker failure recovery",
  },
  {
    title: "A queue delivers the same message twice",
    failure: "The consumer may commit its work and crash before acknowledging the message.",
    answer:
      "Assume delivery is at least once. Give each logical message a stable identifier, commit the state change and deduplication record atomically, then acknowledge. If the effect is external, use an idempotency key or an outbox-driven retry instead of claiming the whole workflow is exactly once.",
    cue: "Place the acknowledgement after durable work, and make redelivery safe.",
    href: "/investigations/job-queue",
    link: "Practise designing a job queue",
  },
  {
    title: "The database primary fails after acknowledging a write",
    failure: "A promoted replica might not contain a write the client was told had succeeded.",
    answer:
      "Ask what an acknowledgement promises and what recovery point objective is acceptable. Synchronous replication can preserve acknowledged writes at higher latency; asynchronous replication can lose recent writes during failover. Make client retries idempotent and explain how stale reads behave while replicas catch up.",
    cue: "State the durability and availability contract before choosing failover behavior.",
    href: "/concepts/replication",
    link: "Review replication and failover guarantees",
  },
  {
    title: "A cache serves stale data after an update or deletion",
    failure: "A successful database write does not automatically invalidate every cached copy.",
    answer:
      "Name the freshness promise first. Use versioned values or targeted invalidation for updates, bounded TTL as a backstop, and a source-of-truth check where stale data would violate a safety or deletion requirement. Explain what happens when invalidation is delayed or lost.",
    cue: "TTL bounds staleness; it does not make a cache strongly consistent.",
    href: "/investigations/distributed-cache",
    link: "Practise distributed cache trade-offs",
  },
  {
    title: "One hot key overloads a partition",
    failure: "Average traffic looks healthy while one tenant, account, or object receives a disproportionate share.",
    answer:
      "Measure load by key and partition, not only cluster average. Depending on the access pattern, split or salt the hot key, replicate reads, or move exceptional tenants to dedicated capacity. Then account for merge work, ordering, and the harder writes that sharding creates.",
    cue: "Scaling the cluster does not help if every request still lands on the same key.",
    href: "/investigations/news-feed",
    link: "Practise uneven feed traffic",
  },
  {
    title: "A live data migration misses writes during cutover",
    failure: "A backfill can copy a consistent snapshot while newer writes continue to the old store.",
    answer:
      "Capture changes before or during the backfill, replay them to the destination, compare counts and critical invariants, and switch reads only after the new copy catches up. Keep a rollback path and delay stopping the old write path until the new one is verified.",
    cue: "A snapshot alone cannot account for writes that arrive while it is copied.",
    href: "/investigations/shard-live-database",
    link: "Practise a safe live data migration",
  },
  {
    title: "A queue backlog keeps growing",
    failure: "Producers add work faster than consumers can finish it, so requests become stale even while every worker appears busy.",
    answer:
      "Compare arrival and completion rates, then track the age of the oldest item as well as queue depth. Find whether work is slow, stuck, or unevenly distributed. Add consumers only if the downstream system has capacity; otherwise rate-limit producers, shed optional work, or make the workload cheaper. Define how the backlog drains and route poison messages aside so one item cannot block progress.",
    cue: "Queue depth shows volume; oldest-message age shows how long users have been waiting.",
    href: "/concepts/backpressure",
    link: "Review backpressure and overload control",
  },
  {
    title: "A popular cache entry expires and overloads the database",
    failure: "Many concurrent requests miss the same expired key and all try to rebuild it from the source at once.",
    answer:
      "Treat the cache miss as a burst, not as one isolated request. Coalesce concurrent fills so one request fetches the value, stagger expirations with jitter, and consider refreshing a hot value before it expires. If stale data can be served briefly, say how long and for which data; protect the origin with bounded concurrency or load shedding either way.",
    cue: "More database capacity does not prevent duplicate work for the same key.",
    href: "/investigations/distributed-cache",
    link: "Practise distributed cache failure modes",
  },
  {
    title: "A slow dependency exhausts the service's connection pool",
    failure: "Requests hold connections while waiting on a dependency, leaving healthy requests unable to reach the database or finish their work.",
    answer:
      "Bound each wait with a deadline and keep a slow dependency from consuming every worker or connection. Limit concurrent calls, reject or shed low-priority work when saturated, and use a circuit breaker only with a clear recovery policy. Check pool wait time, request latency, and saturation together; retries need backoff and a total deadline so they do not add more load to the slow service.",
    cue: "A timeout at one layer is not enough if callers immediately retry and occupy the pool again.",
    href: "/concepts/backpressure",
    link: "Review backpressure and overload control",
  },
  {
    title: "Events for one user arrive out of order",
    failure: "A delayed older update can overwrite a newer state, even when each event is processed successfully.",
    answer:
      "First decide whether order is required globally or only for one entity. If it is per user or account, partition work by that key and attach a sequence or version so consumers can reject stale updates or wait for a gap to be repaired. Preserve parallelism across unrelated entities, and make replay and duplicate delivery safe.",
    cue: "Ordering one entity's events does not require serializing the entire system.",
    href: "/investigations/chat-message-store",
    link: "Practise message ordering and delivery guarantees",
  },
  {
    title: "A network partition leaves two regions accepting writes",
    failure: "Both sides may believe they are the active owner, creating conflicting updates or stale writers after failover.",
    answer:
      "State which operations may remain available during the partition and what consistency users require. A failover needs an authority rule—such as a quorum or lease—and a way to fence off the old owner before the new one writes. If the system allows writes in both regions, describe conflict resolution and which data can be lost or require reconciliation. Verify that promotion and recovery cannot let an old leader publish late writes.",
    cue: "Routing traffic to a new region does not, by itself, stop the old region from writing.",
    href: "/concepts/leases-and-fencing",
    link: "Review leases and fencing tokens",
  },
] as const;

export default function FailureScenariosPage() {
  return (
    <article className="measure">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@graph": [
              breadcrumbs([
                { name: "System design interview guide", path: "/system-design-interview" },
                { name: "Failure scenarios", path: PATH },
              ]),
              {
                "@type": "Article",
                headline: TITLE,
                description: DESCRIPTION,
                url: SITE_URL + PATH,
                mainEntityOfPage: SITE_URL + PATH,
                datePublished: "2026-10-12",
                dateModified: "2026-10-12",
                inLanguage: "en",
                author: { "@id": SITE_URL + "/#organization" },
                publisher: { "@id": SITE_URL + "/#organization" },
                about: ["System design interview", "Failure scenarios", "Distributed systems reliability"],
              },
              faqPage(FAQ),
            ],
          }),
        }}
      />

      <PageHeader title={`${SCENARIOS.length} system design interview follow-up questions with answers`}>
        Interview follow-ups test whether your design still meets its promises after traffic changes or a component,
        request, or dependency behaves unexpectedly. Practise the reasoning in order: name the impact, protect the
        invariant, contain the failure, recover safely, and say what the recovery costs. These are original practice
        scenarios, not claims about questions asked by a particular employer.
      </PageHeader>
      <p className="mt-2 max-w-[72ch] text-[0.8125rem] leading-relaxed text-ink-3">
        This guide was drafted with AI assistance and has not yet been independently reviewed by a human.{" "}
        <Link href="/ai" className="link">
          How SysGeeks uses AI
        </Link>
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/investigations" className="btn btn-accent">
          Choose an interactive practice question
        </Link>
        <Link href="/review#session" className="btn btn-secondary">
          Try a timed mock interview
        </Link>
      </div>

      <Section id="method" title="A five-step method for answering failure questions">
        <ol className="max-w-[72ch] divide-y divide-rule border-y border-rule">
          {[
            ["Describe the impact", "What does the user see? Is the request delayed, duplicated, lost, or answered with stale data?"],
            ["State the invariant", "What must remain true? For example, one logical payment is charged at most once, or an acknowledged write survives failover."],
            ["Find the failure boundary", "Trace the request, message, or state change to the point where success becomes uncertain. Separate what is durable from what is only in memory."],
            ["Contain and recover", "Explain detection, limits on retries or blast radius, the safe recovery step, and how a stale worker or duplicate event is prevented from corrupting state."],
            ["Verify and name the cost", "Say which metric or reconciliation check confirms recovery, then state the latency, availability, freshness, or operational cost of your choice."],
          ].map(([title, text], index) => (
            <li key={title} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 py-4">
              <span className="pt-0.5 font-heading text-[1.125rem] text-ink-3 tabular-nums">{index + 1}</span>
              <div>
                <h3 className="text-[0.9375rem] font-medium">{title}</h3>
                <p className="mt-1 text-[0.9375rem] leading-relaxed text-ink-2">{text}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-4 max-w-[72ch] text-[0.9375rem] leading-relaxed text-ink-2">
          This is a reasoning aid, not a script to recite. Ask which guarantee the interviewer cares about before
          reaching for a queue, cache, retry, or failover policy.
        </p>
      </Section>

      <Section id="worked-example" title="Worked example: the payment response disappears">
        <div className="max-w-[72ch] space-y-4 text-[0.9375rem] leading-relaxed text-ink-2">
          <p>
            A checkout request reaches a payment provider. The provider captures the money, but the response times out
            before your service receives it. The customer retries. The key fact is that a timeout describes what the
            caller observed; it does not prove the provider did nothing.
          </p>
          <dl className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
            <dt className="font-medium text-ink">Invariant</dt>
            <dd>One logical checkout must not create two successful charges.</dd>
            <dt className="font-medium text-ink">Containment</dt>
            <dd>Keep the checkout pending and reuse its durable idempotency key for the retry.</dd>
            <dt className="font-medium text-ink">Recovery</dt>
            <dd>Query or retry against the provider using that key; reconcile cases that remain uncertain.</dd>
            <dt className="font-medium text-ink">Trade-off</dt>
            <dd>The customer may wait longer for a confirmed result, but the system avoids blindly creating another charge.</dd>
          </dl>
          <p>
            A strong answer also asks whether the provider guarantees idempotency and for how long. If its key expires
            before a delayed retry, the design needs a status lookup or a human reconciliation path.{" "}
            <PracticeEntryLink
              href="/investigations/payment-workflow/diagnose-the-double-charge"
              investigationId="payment-workflow"
              source="failure_scenarios_guide"
              className="link"
            >
              Practise the full payment failure
            </PracticeEntryLink>
            .
          </p>
        </div>
      </Section>

      <Section id="drills" title={`${SCENARIOS.length} system design interview follow-up questions to practise`}>
        <ol className="max-w-[72ch] divide-y divide-rule border-y border-rule">
          {SCENARIOS.map((scenario) => {
            const investigationId = scenario.href.match(/^\/investigations\/([^/]+)/)?.[1];
            const className = "mt-2 inline-block text-[0.8125rem] font-medium text-accent hover:underline";

            return (
              <li key={scenario.title} className="py-5">
                <h3 className="text-[1rem] font-medium">{scenario.title}</h3>
                <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-2">
                  <strong className="font-medium text-ink">Failure: </strong>
                  {scenario.failure}
                </p>
                <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-2">
                  <strong className="font-medium text-ink">Reason through it: </strong>
                  {scenario.answer}
                </p>
                <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-3">Listen for: {scenario.cue}</p>
                {investigationId ? (
                  <PracticeEntryLink
                    href={scenario.href}
                    investigationId={investigationId}
                    source="failure_scenarios_guide"
                    className={className}
                  >
                    {scenario.link} →
                  </PracticeEntryLink>
                ) : (
                  <Link href={scenario.href} className={className}>
                    {scenario.link} →
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </Section>

      <Section id="self-check" title="Check your answer before moving on">
        <ul className="max-w-[66ch] list-disc space-y-2 pl-5 text-[0.9375rem] leading-relaxed text-ink-2">
          <li>Did you describe what the user or caller observes, rather than only naming a component failure?</li>
          <li>Did you state which guarantee must survive and identify where the operation becomes uncertain?</li>
          <li>Are retries bounded and safe to repeat, including after a partial success?</li>
          <li>Did you cover detection, recovery, and a way to verify the recovered state?</li>
          <li>Did you name the cost or weaker guarantee your solution accepts?</li>
        </ul>
        <p className="mt-4 max-w-[66ch] text-[0.9375rem] leading-relaxed text-ink-2">
          For a broader practice plan, continue with the{" "}
          <Link href="/system-design-interview" className="link">
            system design interview preparation guide
          </Link>
          , or use the{" "}
          <Link href="/system-design-interview/scorecard" className="link">
            printable interview scorecard
          </Link>{" "}
          to choose one skill to improve next.
        </p>
      </Section>

      <Section id="faq" title="Frequently asked questions">
        <dl className="max-w-[72ch] divide-y divide-rule border-y border-rule">
          {FAQ.map((item) => (
            <div key={item.question} className="py-4">
              <dt className="font-medium">{item.question}</dt>
              <dd className="mt-2 text-[0.9375rem] leading-relaxed text-ink-2">{item.answer}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section id="references" title="Primary references">
        <p className="max-w-[72ch] text-[0.9375rem] leading-relaxed text-ink-2">
          The examples above describe general design choices. These vendor documents show how specific systems define
          retry, delivery, and replication guarantees. Check the guarantees of the service you use before applying a
          pattern to it.
        </p>
        <ul className="mt-4 max-w-[72ch] divide-y divide-rule border-y border-rule text-[0.875rem]">
          <li className="py-3">
            <a className="link" href="https://docs.stripe.com/api/idempotent_requests">
              Stripe: Idempotent requests
            </a>
            <span className="text-ink-3"> — Reusing an idempotency key to retry an uncertain request.</span>
          </li>
          <li className="py-3">
            <a
              className="link"
              href="https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/standard-queues-at-least-once-delivery.html"
            >
              Amazon SQS: At-least-once delivery
            </a>
            <span className="text-ink-3"> — Why a standard queue can deliver a message more than once.</span>
          </li>
          <li className="py-3">
            <a className="link" href="https://kafka.apache.org/40/design/design/">
              Apache Kafka: Message delivery semantics
            </a>
            <span className="text-ink-3"> — Delivery guarantees and the role of consumer state.</span>
          </li>
          <li className="py-3">
            <a className="link" href="https://www.postgresql.org/docs/current/high-availability.html">
              PostgreSQL: High availability and replication
            </a>
            <span className="text-ink-3"> — The data-loss and latency tradeoffs between asynchronous and synchronous replication.</span>
          </li>
          <li className="py-3">
            <a className="link" href="https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Best_Practice_Recommended_Alarms_AWS_Services.html">
              Amazon CloudWatch: Recommended SQS alarms
            </a>
            <span className="text-ink-3"> — Use the age of the oldest message with queue depth to spot work that is falling behind.</span>
          </li>
          <li className="py-3">
            <a className="link" href="https://redis.io/blog/how-to-tame-the-thundering-herd-problem/">
              Redis: How to tame the thundering herd problem
            </a>
            <span className="text-ink-3"> — Cache stampedes, request coalescing, expiry jitter, and overload controls.</span>
          </li>
          <li className="py-3">
            <a className="link" href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/data-modeling-blocks.html">
              Amazon DynamoDB: Write sharding
            </a>
            <span className="text-ink-3"> — How a hot partition can throttle a workload and when spreading a hot key helps.</span>
          </li>
          <li className="py-3">
            <a className="link" href="https://kafka.apache.org/40/documentation/#intro_guarantees">
              Apache Kafka: Ordering and delivery guarantees
            </a>
            <span className="text-ink-3"> — Ordering within a topic partition and the role of consumer state.</span>
          </li>
        </ul>
      </Section>
      <ContentUsefulness />
    </article>
  );
}
