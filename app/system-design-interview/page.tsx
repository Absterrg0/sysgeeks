import type { Metadata } from "next";
import Link from "next/link";
import { ContentUsefulness } from "@/components/content-usefulness";
import { PracticeEntryLink } from "@/components/practice-entry-link";
import { ShareButton } from "@/components/share";
import { TrackedDownloadLink } from "@/components/tracked-download-link";
import { DIFFICULTY } from "@/components/investigation/difficulty";
import { DashList, PageHeader, Section } from "@/components/page-header";
import { getConcept, listInvestigations } from "@/lib/content";
import { SYSTEM_DESIGN_FUNDAMENTALS } from "@/lib/content/system-design-fundamentals";
import { DIMENSION_LABELS, DIMENSIONS } from "@/lib/domain/content";
import { breadcrumbs, faqPage, jsonLd, pageMetadata } from "@/lib/metadata";
import { SITE_NAME, SITE_URL } from "@/lib/site";

const PATH = "/system-design-interview";
const PUBLISHED = "2026-10-06";
const MODIFIED = "2026-10-13";

export const metadata: Metadata = pageMetadata({
  title: "How to Prepare for a System Design Interview in 1 Week",
  description:
    "A 45-minute interview plan, focused drills for common system design mistakes, and a one-week practice schedule. Free exercises, no signup.",
  path: PATH,
  imagePath: `${PATH}/opengraph-image`,
});

const LEAD =
  "Practise full designs out loud under a timer. In a high-level design (HLD) round, clarify requirements, estimate load, defend trade-offs, and explain failures. Use this 45-minute plan, one-week schedule, and free interactive exercises.";

const PLAN = [
  {
    step: "Pin down the requirements",
    minutes: "about 5 minutes",
    text: "Ask what users do (the functional requirements) and how well it must work: scale, latency, durability, consistency (the non-functional ones). Then state your assumptions out loud, so the interviewer can correct them before you build on them.",
  },
  {
    step: "Estimate the load",
    minutes: "about 5 minutes",
    text: "Requests per second at peak, storage per year, the ratio of reads to writes. Round freely. The point is not the number but what it tells you: which part of the system is under pressure, and which is not worth optimising.",
    tool: true,
  },
  {
    step: "Sketch the high-level design",
    minutes: "about 10 minutes",
    text: "Clients, the API, the data stores, and any work that happens asynchronously. Then trace one request from end to end across every boundary it crosses, so both of you agree on what the boxes do.",
  },
  {
    step: "Go deep where the requirements make it hard",
    minutes: "about 15 minutes",
    text: "Every question has one or two hard parts: a hot key, an effect that must happen exactly once, a write that fans out to millions of readers. Put two designs side by side, choose one, and say what it costs.",
  },
  {
    step: "Break it",
    minutes: "5 to 10 minutes",
    text: "A worker dies halfway through a job. A message arrives twice. A request times out after it succeeded. Traffic grows ten times. Say what your design does in each case, and change it where the answer is wrong.",
  },
  {
    step: "Close with what it guarantees",
    minutes: "the last few minutes",
    text: "What the design promises, what it assumes, and where it stops working. Interviewers remember a candidate who knows the limits of their own design.",
  },
];

const LISTEN_FOR = [
  "A tradeoff named together with its cost, not just its benefit.",
  "Numbers that change a decision: why one database is enough, or why it is not.",
  "Mechanisms instead of product names: “a durable queue with acknowledgements”, not “use Kafka”.",
  "Precise guarantees: at-least-once delivery with an idempotent consumer, not “exactly once”.",
  "Failure behaviour you volunteer before being asked.",
  "Changing the design calmly when the interviewer changes a constraint.",
];

const MISTAKE_DRILLS = [
  {
    mistake: "You draw components before clarifying the requirements.",
    drill:
      "Before sketching anything, write down who uses the system, two things they need to do, one reliability or latency target, and the assumption you most need to confirm.",
    href: "/investigations/video-processing-pipeline/read-the-requirements",
    label: "Practise requirements before design",
  },
  {
    mistake: "Your estimates do not change any design decision.",
    drill:
      "Estimate average and peak traffic, then retained storage. Name the first component the numbers put under pressure, and one part that does not need scaling yet.",
    href: "/investigations/url-shortener/size-it",
    label: "Practise sizing a URL shortener",
  },
  {
    mistake: "You name a technology but cannot defend the trade-off.",
    drill:
      "For a news feed, compare fan-out on write with fan-out on read. Pick one for ordinary accounts, then say what changes for an account with millions of followers.",
    href: "/investigations/news-feed/push-or-pull",
    label: "Compare feed fan-out designs",
  },
  {
    mistake: "You add a cache, queue, or retry without accounting for its failure modes.",
    drill:
      "Trace a payment that succeeds at the provider but times out before the caller gets a response. Explain how a retry avoids charging twice and how an uncertain result is resolved.",
    href: "/investigations/payment-workflow/diagnose-the-double-charge",
    label: "Practise a payment retry failure",
  },
  {
    mistake: "You can describe the happy path but not recovery after a failure.",
    drill:
      "Stop a video worker halfway through a job. Decide how another worker takes ownership, how completed work is protected, and how a stale worker is kept from publishing an old result.",
    href: "/investigations/video-processing-pipeline/worker-dies-mid-job",
    label: "Practise worker failure recovery",
  },
  {
    mistake: "You go quiet while deciding what to do next.",
    drill:
      "Run a timed mock and say your assumptions, the decision you are weighing, and the next check you will make. Afterward, use the scorecard to choose one skill to repeat.",
    href: "/review#session",
    label: "Start a timed mock interview",
  },
] as const;

const WEEK_PLAN = [
  {
    day: "Day 1 · Find your starting point",
    goal: "Run a 30-minute mock before reading any answers. Score yourself 0–2 on tracing a request, explaining a mechanism, defending a trade-off, adapting to a change, diagnosing a failure, and connecting a guarantee to its implementation. Keep the lowest score for the end of the week.",
    links: [{ label: "Start a timed mock interview", href: "/review#session" }],
  },
  {
    day: "Day 2 · Requirements and estimates",
    goal: "Use a URL shortener prompt. Write down the read and write paths, estimate average and peak QPS, then calculate retained storage. Label assumptions and note which estimate changes your design.",
    links: [
      { label: "Practise the URL shortener", href: "/investigations/url-shortener" },
      { label: "Use the capacity estimator", href: "/capacity-estimator" },
    ],
  },
  {
    day: "Day 3 · Retries and correctness",
    goal: "Trace a payment that succeeds at the provider but times out before the caller receives a response. Decide how a retry avoids a second charge, how duplicate callbacks are handled, and how an uncertain result is reconciled.",
    links: [
      { label: "Practise a payment workflow", href: "/investigations/payment-workflow" },
      { label: "Review idempotency", href: "/concepts/idempotency" },
    ],
  },
  {
    day: "Day 4 · Worker failure and recovery",
    goal: "Stop a worker halfway through a video job. Work out who can retry it, how a stale worker is prevented from publishing an old result, and which signal tells an operator that work is falling behind.",
    links: [
      { label: "Practise the video pipeline failure", href: "/investigations/video-processing-pipeline/worker-dies-mid-job" },
      { label: "Review leases and fencing", href: "/concepts/leases-and-fencing" },
    ],
  },
  {
    day: "Day 5 · Hot keys and uneven traffic",
    goal: "Design a home timeline, then change the prompt so one publisher has millions of followers. Compare fan-out on write with fan-out on read and name the cost that makes a hybrid useful.",
    links: [
      { label: "Practise Twitter's home timeline", href: "/investigations/news-feed" },
      { label: "Review fan-out patterns", href: "/concepts/fan-out" },
    ],
  },
  {
    day: "Day 6 · Start from a blank page",
    goal: "Choose a system you have not studied this week. Use a 45-minute timer, talk through the design, and write requirements, estimates, APIs, the main data model, one deep dive, and one failure before comparing your answer.",
    links: [
      { label: "Choose a design round", href: "/investigations" },
      { label: "Read the blank-page format", href: "/system-design-mock-interview#format" },
    ],
  },
  {
    day: "Day 7 · Review and repeat one weak area",
    goal: "Run another timed mock and compare it with Day 1. Choose the lowest-scoring skill, repeat one related exercise, and change a requirement so you have to reason again instead of recall the same answer.",
    links: [
      { label: "Run the second mock", href: "/review#session" },
      { label: "Pick a focused skill drill", href: "/review#dimension" },
    ],
  },
] as const;

const CONCEPT_IDS = [
  "caching",
  "message-queues",
  "idempotency",
  "delivery-guarantees",
  "partitioning",
  "replication",
  "consistent-hashing",
  "rate-limiting",
  "timeouts",
  "transactional-outbox",
  "fan-out",
  "backpressure",
];

const FAQ = [
  {
    question: "How long is a system design interview?",
    answer:
      "Usually 45 to 60 minutes for a single problem. Expect around 5 minutes on requirements, 5 on estimates, 10 on the high-level design, 15 on the hardest part, and the rest on failures, scale and questions.",
  },
  {
    question: "Do junior engineers get system design interviews?",
    answer:
      "Sometimes, in a lighter form. They become standard from mid-level roles upwards, and for senior roles the system design round often decides the level of the offer.",
  },
  {
    question: "How should experienced engineers prepare for a system design interview?",
    answer:
      "Practise scoping the problem before choosing components, defending a design against a plausible alternative, and tracing how it behaves during failure or migration. Use examples from your work to explain a decision you owned, but leave out confidential details and do not assume the interview prompt has the same scale as your production system.",
  },
  {
    question: "What makes a system design interview senior-level?",
    answer:
      "A senior-level answer explains how the design can be introduced, operated, and changed safely under the prompt's constraints. Cover migration steps, verification, rollback, and the signals that show the change worked. Staff-level prompts may also test how teams adopt the design and share ownership, depending on the role.",
  },
  {
    question: "What is the difference between high-level and low-level design?",
    answer:
      "High-level design (HLD) is about services, data stores and how requests and data flow between them. Low-level design (LLD) is about the inside of one component: its classes, interfaces and data schema. Most system design interviews are high-level, with a deep dive into one component.",
  },
  {
    question: "Should I memorise designs for common questions?",
    answer:
      "No. Interviewers change a constraint precisely to see whether you understand why a design works. Practise the reasoning instead: decide, explain the mechanism, break it, and adapt it when the requirements move.",
  },
  {
    question: "How should I practise for a system design interview?",
    answer:
      "Choose a real system, state its requirements and assumptions, then make the design decisions before reading a worked answer. Compare your reasoning with the answer, test what happens when a component fails or a requirement changes, and finish with a timed mock interview.",
  },
  {
    question: "Can I practise system design interviews alone?",
    answer:
      "Yes. Pick a prompt, talk through a timed design out loud, and compare it with a worked answer afterward. This helps you rehearse your reasoning, though it cannot replace an interviewer who asks follow-up questions.",
  },
  {
    question: "How do I prepare for a system design interview in one week?",
    answer:
      "Practise once a day. Start with a timed baseline, then work on estimates, retries and correctness, worker failures, and uneven traffic. Do a blank-page design near the end of the week, then run a second mock and repeat the skill you scored lowest. A week is a schedule, not a guarantee of an interview result.",
  },
  {
    question: "What are five good system design interview questions to practise first?",
    answer:
      "Lists of common questions vary. A useful starter set is a URL shortener for read-heavy traffic and caching, an API rate limiter for distributed counters, a news feed for fan-out, a payment system for retries and idempotency, and a job queue for acknowledgements and worker failures. These cover distinct constraints, so compare the tradeoffs instead of memorizing five diagrams.",
  },
  {
    question: `Is ${SITE_NAME} free?`,
    answer: `Yes. ${SITE_NAME} is free, needs no account, and keeps your progress in your browser.`,
  },
];

export default function SystemDesignInterviewPage() {
  const investigations = listInvestigations();
  const levels = (["foundational", "intermediate", "advanced"] as const).map((level) => ({
    level,
    items: investigations.filter((inv) => inv.difficulty === level),
  }));
  const concepts = CONCEPT_IDS.flatMap((id) => {
    const c = getConcept(id);
    return c ? [c] : [];
  });

  return (
    <article className="measure">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@graph": [
              breadcrumbs([{ name: "System design interview guide", path: PATH }]),
              {
                "@type": "Article",
                headline: "How to prepare for a system design interview",
                description: LEAD,
                url: `${SITE_URL}${PATH}`,
                mainEntityOfPage: `${SITE_URL}${PATH}`,
                datePublished: PUBLISHED,
                dateModified: MODIFIED,
                image: `${SITE_URL}${PATH}/opengraph-image`,
                inLanguage: "en",
                author: { "@id": `${SITE_URL}/#organization` },
                publisher: { "@id": `${SITE_URL}/#organization` },
                about: ["System design interview", "Distributed systems", "Software engineering interview"],
              },
              faqPage(FAQ),
            ],
          }),
        }}
      />
      <PageHeader
        title="How to prepare for a system design interview in one week"
        meta={`By SysGeeks · Updated ${formatDate(MODIFIED)}`}
        actions={
          <>
            <Link href="/review#session" className="btn btn-accent">
              Try a 45-minute mock
            </Link>
            <Link href="/investigations" className="btn btn-secondary">
              Browse practice questions
            </Link>
            <ShareButton
              url={`${SITE_URL}${PATH}`}
              title="How to prepare for a system design interview in one week"
              text="A practical 45-minute system design interview plan, a one-week practice schedule, and free solo exercises."
            />
          </>
        }
      >
        {LEAD}
      </PageHeader>

      <Section id="tests" title="What does a system design interview test?">
        <p className="max-w-[66ch] text-[1rem] leading-relaxed text-ink-2">
          Six abilities, and every question exercises several of them. They are also how every exercise on {SITE_NAME}{" "}
          is tagged, so your progress shows which ones you are weak in.
        </p>
        <dl className="mt-6 max-w-[66ch] divide-y divide-rule border-y border-rule">
          {DIMENSIONS.map((d) => (
            <div key={d} className="grid gap-x-6 gap-y-1 py-3 sm:grid-cols-[13rem_minmax(0,1fr)]">
              <dt className="text-[0.9375rem] font-medium">{DIMENSION_LABELS[d].verb}</dt>
              <dd className="text-[0.9375rem] leading-relaxed text-ink-2">{DIMENSION_LABELS[d].description}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section id="plan" title="How should you spend the 45 minutes?">
        <ol className="max-w-[66ch] space-y-6">
          {PLAN.map((item, i) => (
            <li key={item.step} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3">
              <span className="pt-0.5 font-heading text-[1.125rem] text-ink-3 tabular-nums">{i + 1}</span>
              <div>
                <h3 className="text-[1rem] font-medium">
                  {item.step} <span className="font-normal text-ink-3">({item.minutes})</span>
                </h3>
                <p className="mt-1 text-[0.9375rem] leading-relaxed text-ink-2">{item.text}</p>
                {"tool" in item && item.tool ? (
                  <Link href="/capacity-estimator" className="mt-2 inline-block text-[0.8125rem] font-medium text-accent hover:underline">
                    Estimate QPS, storage and bandwidth →
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-6 max-w-[66ch] text-[0.9375rem] leading-relaxed text-ink-2">
          Want more practice with retries, worker crashes, queue backlogs, cache failures, or split-brain writes? Use the{" "}
          <Link href="/system-design-interview/failure-scenarios" className="link">
            system design interview follow-up questions and failure scenarios
          </Link>{" "}
          for a five-step answer method and 12 worked drills.
        </p>
      </Section>

      <Section id="practice-alone" title="How to practise system design alone">
        <div className="max-w-[66ch] space-y-4 text-[0.9375rem] leading-relaxed text-ink-2">
          <p>
            You can rehearse a full answer without a practice partner. Choose a prompt you have not studied, set a
            45-minute timer, and explain your decisions out loud before you read a worked answer. Use the time plan
            above, and write down the assumptions that affect your design.
          </p>
          <p>
            At the end, compare your answer with the walkthrough. Look for a requirement you missed, a number that did
            not change a decision, or a failure you could not explain. Then repeat the question later and see whether
            your reasoning has changed.
          </p>
          <p>
            A solo run can show you where your answer is weak, but it cannot reproduce an interviewer&apos;s follow-up
            questions. Use a mock interview when you want to practise responding in the moment.
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1">
            {investigations[0] && (
              <Link href={`/investigations/${investigations[0].id}`} className="font-medium text-accent hover:underline">
                Try an interactive system design question
              </Link>
            )}
            <Link href="/review#session" className="font-medium text-accent hover:underline">
              Start a timed mock interview
            </Link>
            <Link href="/system-design-mock-interview" className="font-medium text-accent hover:underline">
              How the mock interview works
            </Link>
            <Link href="/system-design-interview/ai-system-design" className="font-medium text-accent hover:underline">
              Practise AI system design interview questions
            </Link>
            <Link href="/system-design-interview/worksheet" className="font-medium text-accent hover:underline">
              Download the free system design interview cheat sheet
            </Link>
            <Link href="/system-design-interview/scorecard" className="font-medium text-accent hover:underline">
              Use the printable system design interview scorecard
            </Link>
          </div>
        </div>
      </Section>

      <Section
        id="week-plan"
        title="A one-week system design interview practice plan"
        description="Use one 30–45 minute session a day. The sequence moves from a timed baseline to estimates, correctness, failures, a blank-page design, and a second mock. It is a study schedule, not a promise of an interview result."
      >
        <ol className="max-w-[72ch] divide-y divide-rule border-y border-rule">
          {WEEK_PLAN.map((item) => (
            <li key={item.day} className="py-4">
              <h3 className="text-[0.9375rem] font-medium">{item.day}</h3>
              <p className="mt-1 text-[0.9375rem] leading-relaxed text-ink-2">{item.goal}</p>
              <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[0.8125rem] font-medium">
                {item.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-accent hover:underline">
                      {link.label} →
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="listen" title="What do interviewers listen for?">
        <DashList items={LISTEN_FOR} />
      </Section>

      <Section id="experienced" title="How should experienced engineers prepare?">
        <div className="max-w-[66ch] space-y-4 text-[0.9375rem] leading-relaxed text-ink-2">
          <p>
            At mid and senior levels, naming familiar services is not enough. Show how a requirement leads to a design
            choice, what that choice costs, and what evidence would make you change it. Start from the prompt&apos;s scale
            instead of copying a production architecture from memory.
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              State the constraint that drives each decision, then compare it with one workable alternative.
            </li>
            <li>
              Explain how the system changes safely. Include migration, verification, rollback, and the signals that
              tell the team when to continue or stop.
            </li>
            <li>
              Use a work example to explain a decision you owned. Keep private company details out, and be clear about
              what you personally decided.
            </li>
          </ul>
          <p>
            A live database migration makes these decisions concrete. Before sharding, choose a key that keeps related
            reads together and keep the current database authoritative. Capture writes before backfill, prevent an old
            copied row from overwriting a newer write, then compare the two stores while users still read from the
            original. Define what counts as a safe cutover and how to return to the old path if the checks fail.
          </p>
          <p>
            A strong answer covers the transition and its safety conditions alongside the target architecture. The{" "}
            <Link href="/investigations/shard-live-database" className="link">
              live database sharding exercise
            </Link>{" "}
            walks through the write log, version checks, backfill, dark reads, verification, and cutover.
          </p>
          <p>Use advanced prompts to practise the same reasoning:</p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2 font-medium">
            <li>
              <Link href="/investigations/chat-message-store" className="text-accent hover:underline">
                Store trillions of chat messages
              </Link>
            </li>
            <li>
              <Link href="/investigations/realtime-collaboration" className="text-accent hover:underline">
                Design a collaborative editor
              </Link>
            </li>
          </ul>
        </div>
      </Section>

      <Section
        id="mistakes"
        title="Common system design interview mistakes and a drill for each"
        description="After a mock, note the first moment your reasoning became unclear. Pick one matching drill, practise it, then run another round."
      >
        <ol className="grid gap-3 sm:grid-cols-2">
          {MISTAKE_DRILLS.map((item) => (
            <li key={item.mistake} className="rounded-xl border border-rule-soft bg-raised p-4">
              <h3 className="text-[0.9375rem] font-medium">{item.mistake}</h3>
              <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-2">{item.drill}</p>
              <PracticeEntryLink
                href={item.href}
                investigationId={item.href.split("/")[2] ?? "unknown"}
                source="interview_guide_mistake_drill"
                className="mt-3 inline-block text-[0.8125rem] font-medium text-accent hover:underline"
              >
                {item.label} →
              </PracticeEntryLink>
            </li>
          ))}
        </ol>
      </Section>

      <Section
        id="questions"
        title="System design interview questions to practise"
        description="Each one is worked through in stages: you decide and explain before you see the reasoning. Every question also has a full written answer."
      >
        <div className="space-y-8">
          {levels.map(({ level, items }) =>
            items.length === 0 ? null : (
              <div key={level}>
                <h3 className="mb-3 text-[0.875rem] font-medium text-ink-2">{DIFFICULTY[level]}</h3>
                <ul className="divide-y divide-rule border-y border-rule">
                  {items.map((inv) => (
                    <li key={inv.id} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3">
                      <PracticeEntryLink
                        href={`/investigations/${inv.id}`}
                        investigationId={inv.id}
                        source="interview_guide_question_list"
                        className="text-[0.9375rem] font-medium hover:text-accent"
                      >
                        {inv.searchTitle}
                      </PracticeEntryLink>
                      <Link href={`/investigations/${inv.id}/review`} className="text-[0.8125rem] text-ink-3 hover:text-ink">
                        Read the answer
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ),
          )}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link className="btn btn-accent" href="/investigations">
            Read the question and answer outlines
          </Link>
          <TrackedDownloadLink
            className="btn btn-secondary"
            href="/downloads/system-design-interview-questions-and-answers.pdf"
            resource="system_design_questions_answers"
          >
            Download the {investigations.length + SYSTEM_DESIGN_FUNDAMENTALS.length}-question answers PDF
          </TrackedDownloadLink>
        </div>
        <p className="mt-6 max-w-[66ch] text-[0.9375rem] leading-relaxed text-ink-2">
          Looking for a worked answer to a classic video platform prompt? Read the separate{" "}
          <Link href="/system-design-interview/design-youtube" className="link">
            YouTube system design interview walkthrough
          </Link>
          , including upload, transcoding, playback and CDN trade-offs. For a current AI infrastructure prompt, see
          the{" "}
          <Link href="/system-design-interview/design-llm-inference" className="link">
            LLM inference service system design walkthrough
          </Link>
          , which covers token-based estimates, GPU admission, batching and streamed failures.
          For retrieval-augmented generation, see the{" "}
          <Link href="/system-design-interview/design-rag-system" className="link">
            RAG system design interview walkthrough
          </Link>
          , which covers document freshness, permission-scoped retrieval, citations, and evaluation.
          For an agent that can take actions, work through the{" "}
          <Link href="/system-design-interview/design-ai-agent" className="link">
            AI agent system design interview walkthrough
          </Link>
          , which focuses on scoped tools, idempotent actions, prompt injection, and uncertain outcomes.
          For a source-based social feed prompt, read the{" "}
          <Link href="/system-design-interview/design-instagram-feed" className="link">
            Instagram feed system design interview guide
          </Link>
          , which separates followed content from recommendations and works through staged ranking and bounded fan-out.
          For typeahead search, read the{" "}
          <Link href="/system-design-interview/design-search-autocomplete" className="link">
            search autocomplete system design walkthrough
          </Link>
          , which compares prefix indexes, ranking, freshness, and query privacy. For secure real-time messaging,
          read the{" "}
          <Link href="/system-design-interview/design-whatsapp" className="link">
            WhatsApp system design interview walkthrough
          </Link>
          , including offline delivery, retry safety, and multi-device fan-out.
        </p>
      </Section>

      {concepts.length > 0 && (
        <Section id="concepts" title="Which concepts should you know first?">
          <ul className="grid max-w-[66ch] gap-x-8 gap-y-3 sm:grid-cols-2">
            {concepts.map((c) => (
              <li key={c.id}>
                <Link href={`/concepts/${c.id}`} className="text-[0.9375rem] font-medium hover:text-accent">
                  {c.title}
                </Link>
                <p className="mt-0.5 text-[0.8125rem] leading-snug text-ink-2">{c.summary}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section id="faq" title="Frequently asked questions">
        <dl className="max-w-[66ch] space-y-6">
          {FAQ.map((item) => (
            <div key={item.question}>
              <dt className="text-[1rem] font-medium">{item.question}</dt>
              <dd className="mt-1 text-[0.9375rem] leading-relaxed text-ink-2">{item.answer}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <section aria-label="Start practising" className="section border-t border-rule">
        <p className="max-w-[60ch] font-display text-[1.375rem] leading-snug">
          The fastest way to get better is to reason through a real system and check your answer against a worked one.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {investigations[0] && (
            <PracticeEntryLink
              href={`/investigations/${investigations[0].id}`}
              investigationId={investigations[0].id}
              source="interview_guide_final_cta"
              className="btn btn-primary"
            >
              Start with {investigations[0].searchTitle.toLowerCase()}
            </PracticeEntryLink>
          )}
          <Link href="/review#session" className="btn btn-secondary">
            Take a mock interview
          </Link>
        </div>
      </section>
      <ContentUsefulness />
    </article>
  );
}

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
