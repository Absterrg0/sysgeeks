import type { Metadata } from "next";
import Link from "next/link";
import { InvestigationIndex } from "@/components/investigation/investigation-index";
import { PageHeader } from "@/components/page-header";
import { getInvestigation, listInvestigations } from "@/lib/content";
import SYSTEM_DESIGN_ANSWERS from "@/lib/content/system-design-answers.json";
import { itemList, jsonLd, pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata({
  title: "14 System Design Interview Questions and Answers",
  description:
    "14 system design interview questions with short answers, design tradeoffs and full interactive walkthroughs. Free practice, no signup.",
  path: "/investigations",
});

const PRACTICE_PATH = SYSTEM_DESIGN_ANSWERS;

export default function InvestigationsPage() {
  const investigations = listInvestigations();
  const practicePath = PRACTICE_PATH.flatMap(({ id, title, focus, answer }) => {
    const investigation = getInvestigation(id);
    return investigation ? [{ investigation, title, focus, answer }] : [];
  });
  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(
            itemList(
              "System design interview questions and worked answers",
              investigations.map((inv) => ({ name: inv.searchTitle, path: `/investigations/${inv.id}` })),
            ),
          ),
        }}
      />
      <PageHeader title="14 system design interview questions and answers">
        Practice each question as a full interview exercise. Set requirements, estimate capacity, make the design
        decisions, then test failures and changed constraints before comparing your reasoning with the worked answer.
        New to the format? Start with{" "}
        <Link href="/system-design-interview" className="link">
          how the interview works
        </Link>
        .
      </PageHeader>
      <section aria-labelledby="practice-path" className="mt-8 max-w-[72ch]">
        <h2 id="practice-path" className="font-display text-[1.375rem] leading-tight tracking-[-0.015em]">
          {PRACTICE_PATH.length} system design interview questions with short answers
        </h2>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-2">
          These summaries show the key design choice and its cost; the full answer depends on the requirements and
          scale you agree on in the interview. Use each one as a starting point, then work through the linked exercise
          before reading its complete walkthrough.
        </p>
        <ol className="mt-5 divide-y divide-rule border-y border-rule">
          {practicePath.map(({ investigation, title, focus, answer }) => (
            <li key={investigation.id} className="py-3.5">
              <h3 className="text-[0.9375rem] font-medium">
                <Link href={`/investigations/${investigation.id}`} className="transition-colors hover:text-accent">
                  {title}
                </Link>
              </h3>
              <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-2">
                <strong className="font-medium text-ink">Short answer: </strong>
                {answer}
              </p>
              <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-3">
                Practise: {focus}{" "}
                <Link href={`/investigations/${investigation.id}/review`} className="font-medium text-accent hover:underline">
                  Read the full worked answer →
                </Link>
              </p>
            </li>
          ))}
        </ol>
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
          <a className="btn btn-secondary" href="/downloads/system-design-interview-questions-and-answers.pdf" download>
            Download all 14 questions and answers (PDF)
          </a>
          <Link href="/system-design-playground" className="btn btn-secondary">
            Try interactive system design interview practice
          </Link>
          <span className="text-[0.8125rem] text-ink-3">Free, no signup. Includes links to full walkthroughs.</span>
        </div>
      </section>
      <section aria-label="All investigations" className="pt-8 pb-10">
        <InvestigationIndex investigations={investigations} grouped />
      </section>
      <section aria-labelledby="focused-walkthroughs" className="max-w-[66ch] border-t border-rule py-8">
        <h2 id="focused-walkthroughs" className="font-display text-[1.25rem] leading-tight">
          More system design interview walkthroughs
        </h2>
        <ul className="mt-3 divide-y divide-rule border-y border-rule">
          <li className="py-4">
            <h3 className="text-[0.9375rem] font-medium">
              <Link href="/system-design-interview/design-youtube" className="transition-colors hover:text-accent">
                Design YouTube: a video streaming system
              </Link>
            </h3>
            <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-2">
              Work through uploads, transcoding, adaptive playback, CDN caching and failure cases.
            </p>
          </li>
          <li className="py-4">
            <h3 className="text-[0.9375rem] font-medium">
              <Link href="/system-design-interview/design-llm-inference" className="transition-colors hover:text-accent">
                Design an LLM inference service
              </Link>
            </h3>
            <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-2">
              Estimate token throughput, control GPU admission, balance continuous batching with latency, and handle
              streaming failures.
            </p>
          </li>
          <li className="py-4">
            <h3 className="text-[0.9375rem] font-medium">
              <Link href="/system-design-interview/design-rag-system" className="transition-colors hover:text-accent">
                Design a RAG system
              </Link>
            </h3>
            <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-2">
              Design private-document ingestion and retrieval with access controls, citations, freshness, and evaluation.
            </p>
          </li>
          <li className="py-4">
            <h3 className="text-[0.9375rem] font-medium">
              <Link href="/system-design-interview/design-ai-agent" className="transition-colors hover:text-accent">
                Design an AI agent
              </Link>
            </h3>
            <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-2">
              Work through scoped tools, safe external actions, idempotency, prompt injection, and evaluation.
            </p>
          </li>
        </ul>
      </section>
    </div>
  );
}
