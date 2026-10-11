import type { Metadata } from "next";
import Link from "next/link";
import { breadcrumbs, jsonLd, pageMetadata } from "@/lib/metadata";
import { SITE_NAME, SITE_URL } from "@/lib/site";

const PATH = "/system-design-interview/worksheet";
const PDF_PATH = "/downloads/system-design-interview-practice-sheet.pdf";
const TITLE = "System Design Interview PDF Worksheet";
const DESCRIPTION =
  "Download a free printable system design interview worksheet with a 45-minute plan, sizing formulas, five practice questions and an answer checklist.";

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

const STEPS = [
  ["5 min", "Clarify the problem", "Agree on users, requirements, quality targets and the assumptions that shape the design."],
  ["5 min", "Estimate the load", "Calculate average and peak requests, data growth and the read-to-write ratio."],
  ["10 min", "Draw the main paths", "Show services, stores, caches and queues. Trace one request and one write."],
  ["15 min", "Choose one hard part", "Compare two plausible designs for the hardest constraint and name the cost you accept."],
  ["5 min", "Break and change it", "Trace a crash, duplicate, timeout or spike. Then adapt to a changed requirement."],
  ["5 min", "State the guarantees", "Explain what the design promises, where it can fail and what you would improve next."],
] as const;

const QUESTIONS = [
  ["Design a URL shortener", "Identifiers, read-heavy traffic, cache invalidation and analytics.", "url-shortener"],
  ["Design an API rate limiter", "Burst handling, shared counters and failure policy.", "api-rate-limiter"],
  ["Design a news feed", "Fan-out, celebrity accounts, inactive readers and deletes.", "news-feed"],
  ["Design a payment system", "Retries, idempotency and out-of-order provider events.", "payment-workflow"],
  ["Design a distributed job queue", "Durable work, duplicate delivery, worker crashes and backlogs.", "job-queue"],
] as const;

export default function SystemDesignWorksheetPage() {
  return (
    <article className="measure">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@graph": [
              breadcrumbs([
                { name: "System design interview guide", path: "/system-design-interview" },
                { name: "Printable practice sheet", path: PATH },
              ]),
              {
                "@type": "WebPage",
                name: TITLE,
                description: DESCRIPTION,
                url: `${SITE_URL}${PATH}`,
                mainEntity: {
                  "@type": "DigitalDocument",
                  name: "Printable system design interview practice sheet",
                  encodingFormat: "application/pdf",
                  contentUrl: `${SITE_URL}${PDF_PATH}`,
                  inLanguage: "en",
                  isAccessibleForFree: true,
                  publisher: { "@id": `${SITE_URL}/#organization` },
                },
              },
            ],
          }),
        }}
      />
      <header className="mb-2 flex flex-wrap items-end justify-between gap-x-10 gap-y-5 border-b border-rule pt-8 pb-6 sm:pt-10">
        <div className="min-w-0 max-w-3xl">
          <p className="mb-2 text-[0.8125rem] text-ink-3">
            <Link href="/system-design-interview" className="hover:text-ink">
              System design interview guide
            </Link>
            <span className="mx-1.5 text-rule-strong">/</span>Printable worksheet
          </p>
          <h1 className="font-display text-[1.75rem] leading-[1.15] tracking-[-0.02em] text-balance sm:text-[2rem]">
            System design interview practice sheet
          </h1>
          <p className="mt-2.5 max-w-[66ch] text-[0.9375rem] leading-relaxed text-ink-2">
            A free, two-page PDF for a 45-minute practice round. It gives you a time plan, quick sizing formulas,
            five questions and a checklist. No signup is needed.
          </p>
        </div>
        <a className="btn btn-accent" href={PDF_PATH} download>
          Download the PDF
        </a>
      </header>

      <section aria-labelledby="plan" className="section">
        <h2 id="plan" className="font-display text-[1.375rem] leading-tight tracking-[-0.015em]">
          The 45-minute plan
        </h2>
        <ol className="mt-5 max-w-[66ch] divide-y divide-rule border-y border-rule">
          {STEPS.map(([time, step, description]) => (
            <li key={step} className="grid gap-x-4 gap-y-1 py-3 sm:grid-cols-[4rem_minmax(0,1fr)]">
              <span className="text-[0.8125rem] font-medium text-accent">{time}</span>
              <div>
                <h3 className="text-[0.9375rem] font-medium">{step}</h3>
                <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-2">{description}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="sizing" className="section">
        <h2 id="sizing" className="font-display text-[1.375rem] leading-tight tracking-[-0.015em]">
          Quick sizing formulas
        </h2>
        <ul className="mt-4 max-w-[66ch] space-y-2 text-[0.9375rem] leading-relaxed text-ink-2">
          <li>Average requests per second = requests per day divided by 86,400.</li>
          <li>Peak requests per second = average requests per second multiplied by the peak factor.</li>
          <li>Raw storage per year = writes per day multiplied by bytes per record and 365.</li>
        </ul>
        <p className="mt-3 max-w-[66ch] text-[0.875rem] leading-relaxed text-ink-2">
          For example, 10 million requests a day is about 116 requests per second on average. At a five-times peak,
          plan for about 580 requests per second.
        </p>
        <Link href="/capacity-estimator" className="mt-3 inline-block text-[0.875rem] font-medium text-accent hover:underline">
          Estimate QPS, storage and bandwidth with the free calculator →
        </Link>
      </section>

      <section aria-labelledby="questions" className="section">
        <h2 id="questions" className="font-display text-[1.375rem] leading-tight tracking-[-0.015em]">
          Five questions to practise
        </h2>
        <ul className="mt-4 max-w-[66ch] divide-y divide-rule border-y border-rule">
          {QUESTIONS.map(([question, focus, investigationId], index) => (
            <li key={question} className="grid gap-x-4 gap-y-1 py-3 sm:grid-cols-[1.5rem_minmax(0,1fr)]">
              <span className="text-[0.8125rem] text-ink-3">{index + 1}.</span>
              <div>
                <p className="text-[0.875rem] leading-relaxed">
                  <span className="font-medium">{question}.</span> <span className="text-ink-2">{focus}</span>
                </p>
                <div className="mt-1 flex flex-wrap gap-x-4 text-[0.8125rem] font-medium">
                  <Link href={`/investigations/${investigationId}`} className="text-accent hover:underline">
                    Try the exercise →
                  </Link>
                  <Link href={`/investigations/${investigationId}/review`} className="text-ink-3 hover:text-ink hover:underline">
                    Read the worked answer
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-4 max-w-[66ch] text-[0.9375rem] leading-relaxed text-ink-2">
          Work through each as an interview, then compare your decisions with a complete explanation. The exercises are
          free and work without an account.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/investigations" className="btn btn-primary">
            Practise the questions
          </Link>
          <a className="btn btn-secondary" href={PDF_PATH} download>
            Download the two-page worksheet
          </a>
        </div>
      </section>

      <p className="section border-t border-rule text-[0.8125rem] text-ink-3">
        Published by {SITE_NAME}. The sheet supports practice; it does not predict how a particular interviewer will
        score an answer.
      </p>
    </article>
  );
}
