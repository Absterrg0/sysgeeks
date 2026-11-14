import type { Metadata } from "next";
import Link from "next/link";
import { ContentUsefulness } from "@/components/content-usefulness";
import { PracticeEntryLink } from "@/components/practice-entry-link";
import { DIFFICULTY } from "@/components/investigation/difficulty";
import { DotArrow } from "@/components/icons";
import { TrackedDownloadLink } from "@/components/tracked-download-link";
import { getInvestigation } from "@/lib/content";
import SYSTEM_DESIGN_ANSWERS from "@/lib/content/system-design-answers.json";
import { SYSTEM_DESIGN_FUNDAMENTALS } from "@/lib/content/system-design-fundamentals";
import { breadcrumbs, faqPage, itemList, jsonLd, pageMetadata } from "@/lib/metadata";
import { SITE_URL } from "@/lib/site";
import { PLAYGROUNDS } from "@/lib/content/playground";

const TOTAL_QUESTION_COUNT = SYSTEM_DESIGN_ANSWERS.length + SYSTEM_DESIGN_FUNDAMENTALS.length;
const TITLE = `${TOTAL_QUESTION_COUNT} System Design Interview Questions and Answers (Free PDF)`;
const DESCRIPTION = `Download a free PDF with ${TOTAL_QUESTION_COUNT} system design interview questions and answers: ${SYSTEM_DESIGN_ANSWERS.length} design exercises and ${SYSTEM_DESIGN_FUNDAMENTALS.length} fundamentals. No signup.`;
const PDF_PATH = "/downloads/system-design-interview-questions-and-answers.pdf";

export const metadata: Metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: "/investigations",
});

const PRACTICE_PATH = SYSTEM_DESIGN_ANSWERS;

const WALKTHROUGHS = [
  { href: "/system-design-interview/design-instagram-feed", title: "Design an Instagram home feed" },
  { href: "/system-design-interview/design-youtube", title: "Design YouTube" },
  { href: "/system-design-interview/design-whatsapp", title: "Design WhatsApp" },
  { href: "/system-design-interview/design-llm-inference", title: "Design an LLM inference service" },
  { href: "/system-design-interview/design-rag-system", title: "Design a RAG system" },
  { href: "/system-design-interview/design-ai-agent", title: "Design an AI agent" },
];

export default function InvestigationsPage() {
  const questionCount = PRACTICE_PATH.length;
  const practicePath = PRACTICE_PATH.flatMap(({ id, title, focus, answer }) => {
    const investigation = getInvestigation(id);
    return investigation ? [{ investigation, title, focus, answer: investigation.answerSummary ?? answer }] : [];
  });
  const levels = (["foundational", "intermediate", "advanced"] as const).map((level) => ({
    level,
    items: practicePath.filter(({ investigation }) => investigation.difficulty === level),
  }));
  const playable = practicePath.filter(({ investigation }) => PLAYGROUNDS[investigation.id]).length;
  return (
    <div className="pt-10 pb-6 sm:pt-14">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(
            {
              "@graph": [
                breadcrumbs([{ name: "System design interview questions and answers", path: "/investigations" }]),
                {
                  "@type": "WebPage",
                  name: TITLE,
                  description: DESCRIPTION,
                  url: `${SITE_URL}/investigations`,
                  mainEntity: itemList(
                    `${SYSTEM_DESIGN_ANSWERS.length} full system design interview problems and worked answers`,
                    PRACTICE_PATH.map(({ id, title }) => ({ name: title, path: `/investigations/${id}/review` })),
                  ),
                  hasPart: {
                    "@type": "DigitalDocument",
                    name: `${TOTAL_QUESTION_COUNT} system design interview questions and answers (PDF)`,
                    encodingFormat: "application/pdf",
                    contentUrl: `${SITE_URL}${PDF_PATH}`,
                    inLanguage: "en",
                    isAccessibleForFree: true,
                    publisher: { "@id": `${SITE_URL}/#organization` },
                  },
                },
                faqPage(SYSTEM_DESIGN_FUNDAMENTALS.map(({ question, answer }) => ({ question, answer }))),
              ],
            },
          ),
        }}
      />

      <header className="max-w-3xl">
        <p className="font-mono text-[0.75rem] text-ink-3">
          {questionCount} systems · {playable} playgrounds · {SYSTEM_DESIGN_FUNDAMENTALS.length} fundamentals · free
        </p>
        <h1 className="mt-4 max-w-[20ch] text-[clamp(2rem,1.6rem+1.4vw,2.75rem)] leading-[1.05] font-semibold tracking-[-0.035em] text-balance">
          {TOTAL_QUESTION_COUNT} system design interview questions and answers.
        </h1>
        <p className="mt-4 max-w-[58ch] text-[1.0625rem] leading-relaxed text-ink-2 text-pretty">
          Pick a system. Learn it by making the decisions, or play with it straight away.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-2.5">
          <PracticeEntryLink
            href="/investigations/url-shortener/playground"
            investigationId="url-shortener"
            source="question_catalog_playground"
            className="btn btn-accent btn-lg group"
          >
            Open playground
            <DotArrow />
          </PracticeEntryLink>
          <TrackedDownloadLink className="btn btn-secondary btn-lg" href={PDF_PATH} resource="system_design_questions_answers">
            Download PDF
          </TrackedDownloadLink>
        </div>
      </header>

      <section aria-labelledby="question-bank" className="mt-14">
        <h2 id="question-bank" className="sr-only">
          {PRACTICE_PATH.length} system design problems with short answers
        </h2>
        <div className="sheet overflow-hidden">
          {levels.map(({ level, items }) =>
            items.length === 0 ? null : (
              <section key={level} aria-labelledby={`questions-${level}`} className="sheet-row">
                <h3
                  id={`questions-${level}`}
                  className="flex items-baseline justify-between gap-2 px-4 pt-4 pb-2 text-[0.75rem] font-medium text-ink-3 sm:px-5"
                >
                  {DIFFICULTY[level]}
                  <span className="font-mono tabular-nums">{items.length}</span>
                </h3>
                <ol>
                  {items.map(({ investigation, title, focus, answer }) => {
                    const hasPlayground = Boolean(PLAYGROUNDS[investigation.id]);
                    return (
                      <li key={investigation.id} className="group/row relative border-t border-rule-soft">
                        <div className="flex items-start gap-4 px-4 py-3 sm:px-5">
                          <div className="min-w-0 flex-1">
                            <h4 className="truncate text-[0.9375rem] font-medium">
                              <PracticeEntryLink
                                href={`/investigations/${investigation.id}`}
                                investigationId={investigation.id}
                                source="question_catalog"
                                className="after:absolute after:inset-x-0 after:top-0 after:h-[3.25rem] sm:after:hidden hover:underline hover:decoration-rule-strong hover:underline-offset-4"
                              >
                                {title}
                              </PracticeEntryLink>
                            </h4>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-3">
                              <p className="font-mono text-[0.75rem] text-ink-3">
                                {investigation.estimatedMinutes} min · {investigation.stages.length} stages
                              </p>
                              <details className="group/answer relative z-10 open:basis-full">
                                <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-[0.75rem] text-ink-3 transition-colors hover:text-ink [&::-webkit-details-marker]:hidden">
                                  <span aria-hidden="true" className="inline-block transition-transform group-open/answer:rotate-90">
                                    ›
                                  </span>
                                  Short answer
                                </summary>
                                <div className="mt-2 mb-1 max-w-[72ch] space-y-1.5 text-[0.875rem] leading-relaxed text-ink-2">
                                  <p>{answer}</p>
                                  <p className="text-[0.8125rem] text-ink-3">
                                    Practise: {focus}{" "}
                                    <Link href={`/investigations/${investigation.id}/review`} className="link">
                                      Full worked answer
                                    </Link>
                                  </p>
                                </div>
                              </details>
                            </div>
                          </div>
                          <div className="relative z-10 flex shrink-0 items-center gap-1.5 pt-0.5">
                            {hasPlayground && (
                              <PracticeEntryLink
                                href={`/investigations/${investigation.id}/playground`}
                                investigationId={investigation.id}
                                source="question_catalog_playground"
                                className="btn btn-sm btn-ghost"
                              >
                                Play
                              </PracticeEntryLink>
                            )}
                            <PracticeEntryLink
                              href={`/investigations/${investigation.id}`}
                              investigationId={investigation.id}
                              source="question_catalog"
                              className="btn btn-sm btn-secondary hidden sm:inline-flex"
                            >
                              Learn
                            </PracticeEntryLink>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>
            ),
          )}
        </div>
      </section>

      <section aria-labelledby="fundamentals" className="mt-16">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
          <h2 id="fundamentals" className="text-[1.375rem] leading-[1.2] font-semibold tracking-[-0.025em]">
            {SYSTEM_DESIGN_FUNDAMENTALS.length} fundamentals, answered.
          </h2>
          <p className="text-[0.8125rem] text-ink-3">Questions interviewers ask on their own.</p>
        </div>
        <div className="sheet mt-5 overflow-hidden">
          {SYSTEM_DESIGN_FUNDAMENTALS.map(({ question, answer, links }) => (
            <details key={question} className="group/faq sheet-row">
              <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 text-[0.9375rem] font-medium transition-colors hover:bg-hover sm:px-5 [&::-webkit-details-marker]:hidden">
                <h3 className="min-w-0 flex-1">{question}</h3>
                <span aria-hidden="true" className="text-ink-3 transition-transform group-open/faq:rotate-45">
                  +
                </span>
              </summary>
              <p className="max-w-[72ch] px-4 pb-4 text-[0.875rem] leading-relaxed text-ink-2 sm:px-5">
                {answer} Read more:{" "}
                {links.map((link, index) => (
                  <span key={link.href}>
                    {index > 0 ? ", " : ""}
                    <Link href={link.href} className="link">
                      {link.label}
                    </Link>
                  </span>
                ))}
                .
              </p>
            </details>
          ))}
        </div>
      </section>

      <section aria-labelledby="focused-walkthroughs" className="mt-16">
        <h2 id="focused-walkthroughs" className="text-[1.375rem] leading-[1.2] font-semibold tracking-[-0.025em]">
          More walkthroughs.
        </h2>
        <ul className="mt-5 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
          {WALKTHROUGHS.map((item) => (
            <li key={item.href} className="border-t border-rule">
              <Link
                href={item.href}
                className="group flex items-center justify-between gap-3 py-3 text-[0.9375rem] text-ink-2 transition-colors hover:text-ink"
              >
                {item.title}
                <span aria-hidden="true" className="text-ink-3 transition-transform group-hover:translate-x-0.5">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <div className="mt-12">
        <ContentUsefulness />
      </div>
    </div>
  );
}
