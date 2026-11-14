import type { Metadata } from "next";
import Link from "next/link";
import { ContentUsefulness } from "@/components/content-usefulness";
import type { ReactNode } from "react";
import { InterviewSetup } from "@/components/interview/interview-setup";
import { PracticeEntryLink } from "@/components/practice-entry-link";
import { ShareButton } from "@/components/share";
import { listInvestigations } from "@/lib/content";
import { listExercises } from "@/lib/content/exercises";
import type { InterviewCandidate } from "@/lib/domain/interview";
import { breadcrumbs, faqPage, jsonLd, pageMetadata } from "@/lib/metadata";
import { SITE_NAME, SITE_URL } from "@/lib/site";

const PATH = "/system-design-mock-interview";
const TITLE = "Free System Design Mock Interview Practice";
const DESCRIPTION =
  "Run a free system design mock interview alone. Choose 30, 45, or 60 minutes, answer follow-up prompts, score six interview skills, and review your debrief. No account needed.";
const PRACTICE_COUNT = listInvestigations().length;

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

const FAQ = [
  {
    question: "How do I practise a system design interview alone?",
    answer:
      "Choose one prompt, set a timer, and explain your reasoning aloud before you look at a reference answer. Spend the round on requirements, estimates, a design choice, and one failure or change in scale. Then use a scorecard to pick one thing to improve. SysGeeks has self-guided 30, 45, and 60-minute rounds that do not need a partner.",
  },
  {
    question: "Where can I practice system design for free?",
    answer:
      `SysGeeks offers free system design interview practice without an account. Work through ${PRACTICE_COUNT} interactive system designs, make decisions before reading the explanations, then explore failure scenarios and the full walkthrough. For a timed round, choose a 30-, 45-, or 60-minute mock.`,
  },
  {
    question: "How long is the system design mock interview?",
    answer:
      "Choose a 30, 45, or 60-minute session. Each length draws a different set of questions covering system design skills such as explaining a concept, making a design decision, reasoning about failures, and defending a design.",
  },
  {
    question: "Does the mock interview show answers while I practise?",
    answer:
      "No. You answer the questions first. References, feedback, and self-assessment appear in the debrief after you finish, so you can try to reason through each prompt on your own.",
  },
  {
    question: "How can I assess my system design interview practice?",
    answer:
      "Score a timed round 0–2 on trace, explain, defend, change, break, and implement. Use the lowest dimension to choose your next drill. This practice aid is not an employer rubric or a hiring prediction.",
  },
  {
    question: "What follow-up questions should I practise in a system design interview?",
    answer:
      "Practise changes that pressure-test the design: tenfold traffic growth, a retry after an uncertain timeout, a worker crash, a hot partition, stale cache data, and a zero-downtime migration. Explain the key assumption, failure mode, trade-off, and signal you would monitor. These are transferable practice prompts, not employer-reported questions.",
  },
  {
    question: `Is the ${SITE_NAME} mock interview free?`,
    answer: `Yes. You can start a timed mock interview without an account. The session runs in your browser.`,
  },
];

const SCORECARD = [
  ["Trace", "Can you follow a request or event through the components and state changes?"],
  ["Explain", "Can you explain how a mechanism works, beyond naming a tool?"],
  ["Defend", "Can you compare an alternative and name the cost of your choice?"],
  ["Change", "Can you adapt the design when traffic or a requirement shifts?"],
  ["Break", "Can you predict a concrete failure and explain recovery?"],
  ["Implement", "Can you connect a guarantee to the API, data model, or code that enforces it?"],
] as const;

const FOLLOW_UP_PROMPTS = [
  [
    "What changes if traffic grows tenfold?",
    "Re-estimate peak reads and writes, find the first saturated component, and explain which scaling change addresses that limit. Avoid adding capacity everywhere by default.",
    "/capacity-estimator",
    "Try the capacity estimator",
  ],
  [
    "What if a payment succeeds but the response times out?",
    "Treat the outcome as unknown until durable state or reconciliation resolves it. Explain how an idempotency key makes a retry safe and what the customer sees meanwhile.",
    "/investigations/payment-workflow",
    "Practise the payment workflow",
  ],
  [
    "What if a worker dies halfway through a job?",
    "Identify what progress was persisted, how another worker takes ownership, and how retries avoid repeating completed side effects.",
    "/investigations/video-processing-pipeline",
    "Practise the video processing pipeline",
  ],
  [
    "What if one partition receives most of the traffic?",
    "Name the key or tenant creating the hotspot, then compare partitioning, replication, caching, or request coalescing. State which consistency or write cost each option adds.",
    "/investigations/chat-message-store",
    "Practise the chat message store",
  ],
  [
    "How stale can a cached value be?",
    "Set the freshness requirement first. Then explain invalidation, refresh, and what the caller should do when the cache or source is unavailable.",
    "/concepts/caching",
    "Review caching trade-offs",
  ],
  [
    "How would you change the data model without downtime?",
    "Describe a staged migration: keep old and new readers compatible, backfill safely, verify parity, switch traffic gradually, and define a rollback point.",
    "/investigations/shard-live-database",
    "Practise a live database migration",
  ],
] as const;

const STEPS = [
  ["Pick a length", "30, 45 or 60 minutes. Balanced, failure-heavy, or aimed at your weak spots."],
  ["Answer before the reference", "Explain a mechanism, make a design call, reason through a failure, defend a system."],
  ["Read the debrief", "Compare with the authored references and mark what you covered. Drill the weakest skill next."],
] as const;

/** A section of the reading column: a heading, then prose or a list. */
function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-16 sm:mt-20">
      <h2 id={id} className="text-[1.375rem] leading-[1.2] font-semibold tracking-[-0.025em] text-balance">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function SystemDesignMockInterviewPage() {
  const candidates: InterviewCandidate[] = listExercises().map((e) => ({
    key: e.key,
    ref: e.ref,
    interactionKind: e.interactionKind,
    phase: e.phase,
    eventKind: e.eventKind,
    dimensions: e.dimensions,
    conceptIds: e.conceptIds,
    minutes: e.minutes,
  }));
  return (
    <article>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@graph": [
              breadcrumbs([{ name: TITLE, path: PATH }]),
              {
                "@type": "SoftwareApplication",
                name: `${SITE_NAME} ${TITLE}`,
                applicationCategory: "EducationalApplication",
                operatingSystem: "Any",
                description: DESCRIPTION,
                url: `${SITE_URL}${PATH}`,
                offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
                publisher: { "@id": `${SITE_URL}/#organization` },
              },
              faqPage(FAQ),
            ],
          }),
        }}
      />

      <header className="grid grid-cols-1 items-start gap-x-14 gap-y-10 pt-10 sm:pt-16 lg:grid-cols-[minmax(0,1fr)_30rem]">
        <div className="lg:pt-4">
          <p className="font-mono text-[0.75rem] text-ink-3">free · no account · runs in your browser</p>
          <h1 className="mt-4 max-w-[16ch] text-[clamp(2rem,1.6rem+1.6vw,3rem)] leading-[1.04] font-semibold tracking-[-0.04em] text-balance">
            Free system design mock interview practice.
          </h1>
          <p className="mt-5 max-w-[46ch] text-[1rem] leading-relaxed text-ink-2 text-pretty">
            Rehearse a timed round on your own. Questions about real systems, answered before you see the reference,
            then an honest debrief. No partner needed.
          </p>
          <ol className="mt-8 max-w-[46ch] space-y-4">
            {STEPS.map(([title, text], i) => (
              <li key={title} className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-2">
                <span className="pt-px font-mono text-[0.75rem] text-ink-3 tabular-nums">0{i + 1}</span>
                <div>
                  <h2 className="text-[0.9375rem] font-semibold tracking-[-0.01em]">{title}</h2>
                  <p className="mt-0.5 text-[0.875rem] leading-relaxed text-ink-2">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div id="start" className="min-w-0">
          <InterviewSetup candidates={candidates} layout="hero" />
          <p className="mt-3 px-1 text-[0.75rem] leading-relaxed text-ink-3">
            Your answers and progress stay in this browser. Want to study first?{" "}
            <PracticeEntryLink href="/investigations" source="mock_interview_landing_browse_systems" className="link">
              Browse the practice systems
            </PracticeEntryLink>
            .
          </p>
        </div>
      </header>

      <div className="mt-6 max-w-[42rem]">
      <Section id="skills" title="What you practise">
        <p className="text-[0.9375rem] leading-relaxed text-ink-2">
          System design interviews test how you reason through a problem, not whether you can recite one reference
          architecture. Sessions draw from SysGeeks exercises about systems such as a URL shortener, rate limiter, news
          feed, payment workflow, and video processing pipeline.
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-[0.9375rem] leading-relaxed text-ink-2">
          <li>Explain a distributed-systems concept in the context of a design.</li>
          <li>Choose an approach and state the cost of the trade-off.</li>
          <li>Diagnose what happens when a component fails or a request times out.</li>
          <li>Change the design when traffic or a requirement changes.</li>
          <li>Defend the guarantees and limits of the system you designed.</li>
        </ul>
        <p className="mt-4 text-[0.9375rem] leading-relaxed text-ink-2">
          This is a self-guided practice tool, not a live interviewer or voice simulation. If you want to study a system
          first, work through an <Link href="/investigations" className="link">interactive system design question</Link> and its written walkthrough, then return for a timed round.
        </p>
      </Section>

      <Section id="scorecard" title="A practical system design interview self-scorecard">
        <div className="space-y-4 text-[0.9375rem] leading-relaxed text-ink-2">
          <p>
            After a mock, score each dimension from 0 to 2. Give yourself 0 if you skipped it, 1 if you did it with
            gaps, and 2 if your reasoning was clear and tied to the stated constraints.
          </p>
          <p>
            These six dimensions come from SysGeeks practice exercises. Use them to choose what to practise next; they
            are not an employer rubric.
          </p>
          <div className="overflow-x-auto">
            <table className="data-table min-w-[36rem]">
              <caption className="sr-only">Six dimensions for reviewing a system design interview practice round</caption>
              <thead>
                <tr>
                  <th scope="col">Dimension</th>
                  <th scope="col">Evidence to look for in your answer</th>
                </tr>
              </thead>
              <tbody>
                {SCORECARD.map(([dimension, evidence]) => (
                  <tr key={dimension}>
                    <th scope="row">{dimension}</th>
                    <td>{evidence}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Do not read the total as a hiring prediction. Pick the lowest dimension, do one focused exercise, then try
            the same prompt again. The{" "}
            <Link href="/review#dimension" className="link">skill drills</Link> sort practice by dimension, and the{" "}
            <Link href="/review#session" className="link">timed mock interview</Link> gives you another round to review.
          </p>
          <p>
            Use the <Link href="/system-design-interview/scorecard" className="link">printable system design interview scorecard</Link> to
            record evidence and plan your next drill.
          </p>
        </div>
      </Section>

      <Section id="solo-prompts" title="System design interview follow-up questions to practise">
        <p className="text-[0.9375rem] leading-relaxed text-ink-2">
          Use these as practice prompts, not as claims about questions asked by a particular employer. In a solo round,
          pause after each major design choice and answer the follow-up before moving on. The 45-minute plan in the{" "}
          <Link href="/system-design-interview#plan" className="link">system design interview guide</Link> gives you a place for that deeper reasoning.
        </p>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-2">
          For worked answers to common failure follow-ups, read the{" "}
          <Link href="/system-design-interview/failure-scenarios" className="link">
            system design interview follow-up questions and failure scenarios guide
          </Link>
          .
        </p>
        <ol className="mt-5 divide-y divide-rule border-y border-rule">
          {FOLLOW_UP_PROMPTS.map(([question, answer, href, linkText]) => (
            <li key={question} className="py-3.5">
              <h3 className="text-[0.9375rem] font-medium">{question}</h3>
              <p className="mt-1 text-[0.9375rem] leading-relaxed text-ink-2">{answer}</p>
              <Link href={href} className="mt-2 inline-flex text-[0.8125rem] font-medium text-ink underline decoration-rule-strong underline-offset-4 hover:decoration-ink">
                {linkText}
              </Link>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-[0.9375rem] leading-relaxed text-ink-2">
          Practise one prompt aloud, write down the assumption that drives your answer, and identify what evidence
          would tell you the design is working. Then compare your reasoning with the linked exercise and its worked
          walkthrough.
        </p>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-2">
          A solo round cannot give you the pushback of a live interviewer. It can still help you practise clear
          reasoning and find one weak spot between peer mocks. SysGeeks practice sessions are free and do not need an
          account.
        </p>
        <PracticeEntryLink
          href="#start"
          source="mock_interview_landing_final_cta"
          className="mt-6 inline-flex btn btn-accent"
        >
          Start a timed system design mock
        </PracticeEntryLink>
      </Section>

      <Section id="faq" title="System design mock interview questions">
        <dl className="divide-y divide-rule border-y border-rule">
          {FAQ.map(({ question, answer }) => (
            <div key={question} className="py-4">
              <dt className="font-medium">{question}</dt>
              <dd className="mt-1 text-[0.9375rem] leading-relaxed text-ink-2">{answer}</dd>
            </div>
          ))}
        </dl>
      </Section>
      <div className="mt-10 flex items-center justify-between gap-4 border-t border-rule pt-5">
        <p className="text-[0.8125rem] text-ink-3">Know someone preparing?</p>
        <ShareButton
          url={`${SITE_URL}${PATH}`}
          title={TITLE}
          text="A free, self-guided system design mock interview with timed rounds and a practical scorecard."
        />
      </div>
      <ContentUsefulness />
      </div>
    </article>
  );
}
