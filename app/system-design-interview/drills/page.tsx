import type { Metadata } from "next";
import Link from "next/link";
import { ContentUsefulness } from "@/components/content-usefulness";
import { TrackedReveal } from "@/components/drills/tracked-reveal";
import { PageHeader, Section } from "@/components/page-header";
import { QUICK_DRILLS } from "@/lib/content/quick-drills";
import { breadcrumbs, faqPage, jsonLd, pageMetadata } from "@/lib/metadata";
import { SITE_NAME, SITE_URL } from "@/lib/site";

const PATH = "/system-design-interview/drills";
const TITLE = "System Design Interview Drills: 8 Quick Failure Scenarios";
const DESCRIPTION =
  "Practise eight one-minute system design drills on retries, queues, caching, and failures. Reveal the reasoning, then open a full exercise. Free; no signup.";

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

const FAQ = [
  {
    question: "What is a system design interview drill?",
    answer:
      "A short prompt that asks you to make one design decision or respond to a failure. Explain the invariant you need to protect, choose a mechanism, and name its cost before checking a worked explanation.",
  },
  {
    question: "Are these real questions from named company interviews?",
    answer:
      "No. These are original SysGeeks practice scenarios about common distributed-systems tradeoffs. They are not claims about questions asked by a particular employer.",
  },
  {
    question: "Can I practise without an account?",
    answer:
      "Yes. The drills and linked exercises are free to use without an account. Your answer choice is not sent anywhere; opening a worked answer records only which drill was revealed, if analytics are enabled.",
  },
];

export default function SystemDesignDrillsPage() {
  return (
    <article className="measure">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@graph": [
              breadcrumbs([
                { name: "System design interview guide", path: "/system-design-interview" },
                { name: "System design interview drills", path: PATH },
              ]),
              {
                "@type": "LearningResource",
                "@id": SITE_URL + PATH + "#resource",
                name: TITLE,
                description: DESCRIPTION,
                url: SITE_URL + PATH,
                learningResourceType: "Interview practice",
                educationalUse: "Practice",
                isAccessibleForFree: true,
                inLanguage: "en",
                author: { "@id": SITE_URL + "/#organization" },
                provider: { "@id": SITE_URL + "/#organization" },
                hasPart: QUICK_DRILLS.map((drill) => ({
                  "@type": "LearningResource",
                  name: drill.title,
                  url: SITE_URL + PATH + "#drill-" + drill.id,
                })),
              },
              faqPage(FAQ),
            ],
          }),
        }}
      />

      <PageHeader title="8 quick system design interview drills" meta="About 1 minute each · Free · No account needed">
        Choose a response to a failure or scaling problem before you reveal the explanation. Each drill focuses on one
        decision, the guarantee it protects, and the trade-off it brings. They are original practice prompts, not
        reported questions from a named company.
      </PageHeader>

      <div className="mt-5 flex flex-wrap gap-3 text-[0.875rem]">
        <Link href="#drill-payment-timeout" className="btn btn-accent">
          Start the first drill
        </Link>
        <Link href="/system-design-interview/failure-scenarios" className="btn btn-secondary">
          Read 12 full failure scenarios
        </Link>
      </div>

      <Section id="drills" title="Pick your response, then reveal the reasoning">
        <ol className="space-y-4">
          {QUICK_DRILLS.map((drill, index) => {
            const answer = drill.choices.find((choice) => choice.id === drill.answerId);
            if (!answer) return null;

            return (
              <li key={drill.id} id={"drill-" + drill.id} className="sheet scroll-mt-24 p-5 sm:p-6">
                <p className="kicker">
                  Drill {String(index + 1).padStart(2, "0")} · about 1 minute · {drill.topic}
                </p>
                <h2 className="mt-2 max-w-[56ch] font-display text-[1.25rem] leading-snug tracking-[-0.01em]">
                  {drill.title}
                </h2>
                <p className="mt-3 max-w-[68ch] text-[0.9375rem] leading-relaxed text-ink-2">{drill.prompt}</p>
                <ol className="mt-4 grid gap-2 text-[0.875rem] leading-relaxed">
                  {drill.choices.map((choice, choiceIndex) => (
                    <li key={choice.id} className="flex gap-2.5 rounded-md border border-rule-soft px-3 py-2.5">
                      <span className="font-mono text-[0.75rem] text-ink-3" aria-hidden="true">
                        {String.fromCharCode(65 + choiceIndex)}
                      </span>
                      <span>{choice.text}</span>
                    </li>
                  ))}
                </ol>
                <TrackedReveal drillId={drill.id}>
                  <summary className="mt-4 cursor-pointer list-none text-[0.875rem] font-semibold text-accent hover:underline">
                    Reveal the answer and reasoning
                  </summary>
                  <div className="mt-4 max-w-[68ch] space-y-3 border-l-2 border-accent-solid/60 pl-4 text-[0.875rem] leading-relaxed text-ink-2">
                    <p>
                      <strong className="font-semibold text-ink">Best response: {answer.text}</strong>
                    </p>
                    <p>{drill.reasoning}</p>
                    <p>
                      <strong className="font-semibold text-ink">Trade-off: </strong>
                      {drill.tradeoff}
                    </p>
                    <ul className="list-disc space-y-1.5 pl-5">
                      {drill.otherChoices.map(({ choiceId, whyNot }) => {
                        const choice = drill.choices.find((item) => item.id === choiceId);
                        return choice ? (
                          <li key={choiceId}>
                            <strong className="font-medium text-ink">Why not “{choice.text}”</strong> {whyNot}
                          </li>
                        ) : null;
                      })}
                    </ul>
                    <Link href={drill.href} className="link inline-block">
                      {drill.linkText} →
                    </Link>
                  </div>
                </TrackedReveal>
              </li>
            );
          })}
        </ol>
      </Section>

      <Section id="next" title="Ready for a full practice round?">
        <div className="max-w-[68ch] space-y-3 text-[0.9375rem] leading-relaxed text-ink-2">
          <p>
            A short drill tests one decision. A full system design interview asks you to connect requirements,
            estimates, architecture, trade-offs, and recovery. Continue with the{" "}
            <Link href="/system-design-mock-interview" className="link">
              timed mock interview
            </Link>{" "}
            or choose one of the{" "}
            <Link href="/investigations" className="link">
              interactive system design questions
            </Link>
            .
          </p>
          <p>
            For a longer set of follow-ups, read the{" "}
            <Link href="/system-design-interview/failure-scenarios" className="link">
              system design failure scenarios guide
            </Link>
            .
          </p>
        </div>
      </Section>

      <Section id="faq" title="Quick drill questions">
        <dl className="max-w-[68ch] divide-y divide-rule border-y border-rule">
          {FAQ.map(({ question, answer }) => (
            <div key={question} className="py-4">
              <dt className="font-medium">{question}</dt>
              <dd className="mt-1 text-[0.875rem] leading-relaxed text-ink-2">{answer}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <p className="text-[0.8125rem] leading-relaxed text-ink-3">
        Written by {SITE_NAME}. These short scenarios are based on the design questions and failure modes in our linked
        exercises. They explain a defensible answer and its cost; other answers may fit different requirements.
      </p>
      <ContentUsefulness />
    </article>
  );
}
