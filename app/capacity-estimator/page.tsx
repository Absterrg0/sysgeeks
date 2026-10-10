import type { Metadata } from "next";
import Link from "next/link";
import { CapacityEstimator } from "@/components/capacity-estimator/capacity-estimator";
import { PageHeader, Section } from "@/components/page-header";
import { breadcrumbs, faqPage, jsonLd, pageMetadata } from "@/lib/metadata";
import { SITE_NAME, SITE_URL } from "@/lib/site";

const PATH = "/capacity-estimator";
const TITLE = "System Design Capacity Estimator";
const DESCRIPTION =
  "Estimate average and peak QPS, storage, and network bandwidth for a system design interview. Free interactive calculator with clear formulas and assumptions.";

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

const FAQ = [
  {
    question: "How do you estimate QPS in a system design interview?",
    answer:
      "Estimate daily operations, divide by 86,400 seconds to get average queries per second, then multiply by a peak-to-average factor. Estimate reads and writes separately because their rates and costs often differ.",
  },
  {
    question: "How is storage estimated?",
    answer:
      "Multiply writes per day by the stored bytes per write and the retention period. Add estimated index and metadata overhead for logical storage, then multiply by the number of stored copies for physical storage.",
  },
  {
    question: "Does this calculator size the servers or database?",
    answer:
      "No. It estimates workload, storage, and network volume from your assumptions. Server and database sizing also depends on measured per-instance capacity, query shape, latency targets, redundancy, and operational headroom.",
  },
  {
    question: `Is this ${SITE_NAME} capacity calculator free?`,
    answer: `Yes. The calculator is free, requires no account, and keeps its inputs in your browser.`,
  },
];

export default function CapacityEstimatorPage() {
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
                applicationCategory: "DeveloperApplication",
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
      <PageHeader title={TITLE} meta="Free · No account · Inputs stay in your browser">
        Estimate average and peak QPS, retained storage, and network throughput from a few workload assumptions. Use the result to guide a system design discussion, then refine the numbers when they affect an architectural choice.
      </PageHeader>

      <Section id="calculator" title="Estimate QPS, storage, and bandwidth">
        <CapacityEstimator />
        <p className="mt-4 max-w-[72ch] text-[0.8125rem] leading-relaxed text-ink-3">
          This is a workload estimate, not a server or database sizing recommendation. Real capacity depends on measured per-instance throughput, query patterns, latency targets, redundancy, and operational headroom.
        </p>
      </Section>

      <Section id="formulas" title="How the estimate is calculated">
        <dl className="max-w-[72ch] divide-y divide-rule border-y border-rule">
          {[
            ["Writes per day", "Daily active users × writes per user per day"],
            ["Reads per day", "Writes per day × reads per write"],
            ["Average QPS", "Operations per day ÷ 86,400 seconds"],
            ["Peak QPS", "Average QPS × peak-to-average factor (at least 1×)"],
            ["Raw retained storage", "Writes per day × bytes per write × 365 × retention years"],
            ["Logical storage", "Raw retained storage × (1 + index and metadata overhead)"],
            ["Physical storage", "Logical storage × stored copies, including the primary"],
            ["Peak network throughput", "Peak operations per second × average request or response bytes"],
          ].map(([term, definition]) => (
            <div key={term} className="grid gap-1 py-3 sm:grid-cols-[13rem_minmax(0,1fr)] sm:gap-5">
              <dt className="text-[0.9375rem] font-medium">{term}</dt>
              <dd className="text-[0.9375rem] leading-relaxed text-ink-2">{definition}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 max-w-[72ch] text-[0.9375rem] leading-relaxed text-ink-2">
          The calculator uses decimal units (1 kB = 1,000 bytes; 1 GB = 1,000,000,000 bytes), a 365-day year, and constant daily activity across the selected retention period. The peak factor is applied to average reads and writes independently.
        </p>
      </Section>

      <Section id="example" title="Worked example: a URL shortener">
        <p className="max-w-[72ch] text-[0.9375rem] leading-relaxed text-ink-2">
          Suppose 10 million people use the service daily, each creates two short links, and each link is followed 100 times. That is 20 million writes and 2 billion reads a day: about 231 average write QPS and 23,148 average read QPS. With a 3× peak factor, design discussions should start around 694 write QPS and 69,444 read QPS at peak.
        </p>
        <p className="mt-3 max-w-[72ch] text-[0.9375rem] leading-relaxed text-ink-2">
          At 500 bytes per link record for five years, raw storage is about 18.3 TB. Adding 50% for indexes and metadata gives about 27.4 TB logical; three stored copies bring that to about 82.1 TB physical. These are planning estimates: real record sizes, deletion policy, compression, and replica placement change the result.
        </p>
        <p className="mt-4 text-[0.9375rem] leading-relaxed">
          Continue with the <Link href="/investigations/url-shortener/review" className="font-medium text-accent hover:underline">URL shortener system design walkthrough</Link> or use the <Link href="/system-design-interview" className="font-medium text-accent hover:underline">system design interview guide</Link> to place estimates in a 45-minute interview plan.
        </p>
      </Section>

      <Section id="faq" title="Capacity estimation questions">
        <dl className="max-w-[72ch] divide-y divide-rule border-y border-rule">
          {FAQ.map(({ question, answer }) => (
            <div key={question} className="py-4">
              <dt className="font-medium">{question}</dt>
              <dd className="mt-1 text-[0.9375rem] leading-relaxed text-ink-2">{answer}</dd>
            </div>
          ))}
        </dl>
      </Section>
    </article>
  );
}
