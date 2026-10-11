import type { Metadata } from "next";
import Link from "next/link";
import { ContentUsefulness } from "@/components/content-usefulness";
import { ShareButton } from "@/components/share";
import { PageHeader, Section } from "@/components/page-header";
import { breadcrumbs, faqPage, jsonLd, pageMetadata } from "@/lib/metadata";
import { SITE_NAME, SITE_URL } from "@/lib/site";

const PATH = "/system-design-mock-interview";
const TITLE = "Free System Design Mock Interview Practice";
const DESCRIPTION =
  "Free system design mock interview practice: timed 30, 45 or 60-minute sessions, follow-up questions, and a self-review scorecard.";

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
      "SysGeeks offers free system design interview practice without an account. Work through 14 interactive system designs, make decisions before reading the explanations, then explore failure scenarios and the full walkthrough. For a timed round, choose a 30-, 45-, or 60-minute mock.",
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

export default function SystemDesignMockInterviewPage() {
  return (
    <article className="measure">
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

      <PageHeader title="Free system design mock interview practice">
        Rehearse a timed system design interview on your own. Choose a 30, 45, or 60-minute session, work through
        questions about real systems, and save the references for the debrief. No account or practice partner needed.
      </PageHeader>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link href="/review#session" className="btn btn-accent btn-lg">
          Choose a mock interview length
        </Link>
        <Link href="/investigations" className="btn btn-secondary btn-lg">
          Browse practice systems
        </Link>
        <ShareButton
          url={`${SITE_URL}${PATH}`}
          title={TITLE}
          text="A free, self-guided system design mock interview with timed rounds and a practical scorecard."
        />
      </div>

      <Section id="format" title="How the mock interview works">
        <ol className="max-w-[72ch] divide-y divide-rule border-y border-rule">
          {[
            ["Choose a length and focus", "Pick 30, 45, or 60 minutes. Use a balanced session, spend more time on failures, or target weak areas after you have practice evidence."],
            ["Answer before you see the reference", "Work through a changing set of prompts. Explain a concept, make a design decision, reason about a failure, or defend a system. Your answers come before the reference material."],
            ["Review the debrief", "After you finish, compare your reasoning with the authored references and assess which parts you covered. Use a missed requirement or weak trade-off as the focus for your next practice round."],
          ].map(([title, text], i) => (
            <li key={title} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 py-4">
              <span className="pt-0.5 font-heading text-[1.125rem] text-ink-3 tabular-nums">{i + 1}</span>
              <div>
                <h2 className="text-[0.9375rem] font-medium">{title}</h2>
                <p className="mt-1 text-[0.9375rem] leading-relaxed text-ink-2">{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="skills" title="What you practise">
        <p className="max-w-[72ch] text-[0.9375rem] leading-relaxed text-ink-2">
          System design interviews test how you reason through a problem, not whether you can recite one reference
          architecture. Sessions draw from SysGeeks exercises about systems such as a URL shortener, rate limiter, news
          feed, payment workflow, and video processing pipeline.
        </p>
        <ul className="mt-4 max-w-[72ch] list-disc space-y-2 pl-5 text-[0.9375rem] leading-relaxed text-ink-2">
          <li>Explain a distributed-systems concept in the context of a design.</li>
          <li>Choose an approach and state the cost of the trade-off.</li>
          <li>Diagnose what happens when a component fails or a request times out.</li>
          <li>Change the design when traffic or a requirement changes.</li>
          <li>Defend the guarantees and limits of the system you designed.</li>
        </ul>
        <p className="mt-4 max-w-[72ch] text-[0.9375rem] leading-relaxed text-ink-2">
          This is a self-guided practice tool, not a live interviewer or voice simulation. If you want to study a system
          first, work through an <Link href="/investigations" className="link">interactive system design question</Link> and its written walkthrough, then return for a timed round.
        </p>
      </Section>

      <Section id="scorecard" title="A practical system design interview self-scorecard">
        <div className="max-w-[72ch] space-y-4 text-[0.9375rem] leading-relaxed text-ink-2">
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
        <p className="max-w-[72ch] text-[0.9375rem] leading-relaxed text-ink-2">
          Use these as practice prompts, not as claims about questions asked by a particular employer. In a solo round,
          pause after each major design choice and answer the follow-up before moving on. The 45-minute plan in the{" "}
          <Link href="/system-design-interview#plan" className="link">system design interview guide</Link> gives you a place for that deeper reasoning.
        </p>
        <ol className="mt-5 max-w-[72ch] divide-y divide-rule border-y border-rule">
          {FOLLOW_UP_PROMPTS.map(([question, answer, href, linkText]) => (
            <li key={question} className="py-3.5">
              <h3 className="text-[0.9375rem] font-medium">{question}</h3>
              <p className="mt-1 text-[0.9375rem] leading-relaxed text-ink-2">{answer}</p>
              <Link href={href} className="mt-2 inline-flex text-[0.8125rem] font-medium text-accent hover:underline">
                {linkText} →
              </Link>
            </li>
          ))}
        </ol>
        <p className="mt-4 max-w-[72ch] text-[0.9375rem] leading-relaxed text-ink-2">
          Practise one prompt aloud, write down the assumption that drives your answer, and identify what evidence
          would tell you the design is working. Then compare your reasoning with the linked exercise and its worked
          walkthrough.
        </p>
        <p className="mt-3 max-w-[72ch] text-[0.9375rem] leading-relaxed text-ink-2">
          A solo round cannot give you the pushback of a live interviewer. It can still help you practise clear
          reasoning and find one weak spot between peer mocks. SysGeeks practice sessions are free and do not need an
          account.
        </p>
        <Link href="/review#session" className="mt-5 inline-flex btn btn-accent">
          Start a timed system design mock
        </Link>
      </Section>

      <Section id="faq" title="System design mock interview questions">
        <dl className="max-w-[72ch] divide-y divide-rule border-y border-rule">
          {FAQ.map(({ question, answer }) => (
            <div key={question} className="py-4">
              <dt className="font-medium">{question}</dt>
              <dd className="mt-1 text-[0.9375rem] leading-relaxed text-ink-2">{answer}</dd>
            </div>
          ))}
        </dl>
      </Section>
      <ContentUsefulness />
    </article>
  );
}
