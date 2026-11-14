import type { Metadata } from "next";
import Link from "next/link";
import { getInvestigation, listCompanies, writeupsByCompany } from "@/lib/content";
import { faqPage, itemList, jsonLd, pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Real-World System Design Case Studies",
  description:
    "Study system design case studies from Google, Amazon, Stripe, and Discord. Trace decisions to original engineering sources, then practise the trade-offs.",
  path: "/companies",
});

export default function CompaniesPage() {
  const companies = listCompanies().map((company) => {
    const writeups = writeupsByCompany(company.id);
    const practise = [...new Set(writeups.flatMap((w) => w.investigationIds))].flatMap((id) => {
      const inv = getInvestigation(id);
      return inv ? [inv] : [];
    });
    const years = writeups.map((w) => w.published.slice(0, 4)).sort();
    return { company, practise, sources: writeups.length, year: years[years.length - 1] };
  });

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(
            {
              "@graph": [
                itemList(
                  "Real-world system design case studies from engineering teams",
                  companies.map(({ company }) => ({ name: `${company.name}: ${company.topic}`, path: `/companies/${company.id}` })),
                ),
                faqPage([
                  {
                    question: "Are these actual system design interview questions from these companies?",
                    answer:
                      "No. These are practice case studies based on engineering work the companies have published. They do not claim that a company asks these exact systems in interviews.",
                  },
                ]),
              ],
            },
          ),
        }}
      />
      <header className="pt-10 sm:pt-14">
        <p className="font-mono text-[0.75rem] text-ink-3">{companies.length} companies · primary sources only</p>
        <h1 className="mt-4 max-w-[20ch] text-[clamp(2rem,1.6rem+1.4vw,2.75rem)] leading-[1.05] font-semibold tracking-[-0.035em] text-balance">
          Real-world system design case studies.
        </h1>
        <p className="mt-4 max-w-[58ch] text-[1rem] leading-relaxed text-ink-2 text-pretty">
          How engineers at Google, Amazon, Meta, Stripe, Discord and others describe systems they built. Each one links to
          the primary source and an exercise where you make the same trade-offs.
        </p>
      </header>

      <section aria-labelledby="practice-method" className="mt-10">
        <h2 id="practice-method" className="sr-only">
          How to use these case studies for interview practice
        </h2>
        <ol className="grid gap-x-10 gap-y-4 border-y border-rule py-5 sm:grid-cols-3">
          {[
            ["Read the source", "Start with the engineers' paper, post, talk, or code, not a secondhand summary."],
            ["Name the trade-off", "Write down the constraint, the mechanism chosen, and the cost that choice accepts."],
            ["Practise the reasoning", "Work through a related exercise before reading its reference answer."],
          ].map(([title, text], index) => (
            <li key={title} className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-1">
              <span className="pt-px font-mono text-[0.75rem] text-ink-3">0{index + 1}</span>
              <div>
                <h3 className="text-[0.9375rem] font-semibold tracking-[-0.01em]">{title}</h3>
                <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-ink-2">{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-label="All companies" className="mt-8 pb-12">
        <ul className="sheet overflow-hidden">
          {companies.map(({ company, practise, sources, year }) => (
            <li key={company.id} className="sheet-row">
              <Link
                href={`/companies/${company.id}`}
                className="group grid gap-x-8 gap-y-1.5 px-5 py-4 transition-colors hover:bg-hover sm:grid-cols-[9rem_minmax(0,1fr)_15rem] sm:px-6"
              >
                <span className="flex items-baseline gap-2 sm:block">
                  <span className="block text-[0.9375rem] font-semibold tracking-[-0.015em]">{company.name}</span>
                  <span className="block font-mono text-[0.6875rem] text-ink-3 sm:mt-1">
                    {sources} source{sources === 1 ? "" : "s"}
                    {year ? ` · ${year}` : ""}
                  </span>
                </span>
                <span className="min-w-0">
                  <span className="block text-[0.9375rem] font-medium tracking-[-0.01em]">{company.topic}</span>
                  <span className="mt-1 line-clamp-2 text-[0.8125rem] leading-relaxed text-ink-2">{company.summary}</span>
                </span>
                {practise[0] && (
                  <span className="flex min-w-0 items-start gap-2 text-[0.8125rem] text-ink-3 sm:justify-end sm:pt-0.5">
                    <span className="min-w-0 sm:text-right">
                      <span className="block text-[0.75rem]">Practise it</span>
                      <span className="block truncate text-ink-2 group-hover:text-ink">{practise[0].title}</span>
                    </span>
                    <span aria-hidden="true" className="mt-3 hidden transition-transform group-hover:translate-x-0.5 sm:inline">
                      →
                    </span>
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="question-claims" className="max-w-[42rem] pb-6">
        <h2 id="question-claims" className="text-[1.375rem] leading-[1.2] font-semibold tracking-[-0.025em]">
          Are these actual interview questions from these companies?
        </h2>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-2">
          No. These are practice case studies based on engineering work the companies have published. They do not claim
          that a company asks these exact systems in interviews. The exercises help you practise transferable design
          decisions against real constraints.
        </p>
      </section>
    </div>
  );
}
