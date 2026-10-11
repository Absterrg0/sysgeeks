import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { SystemThumb } from "@/components/system-thumb";
import { visibleAfter } from "@/lib/domain/visibility";
import { getInvestigation, listCompanies, writeupsByCompany } from "@/lib/content";
import { faqPage, itemList, jsonLd, pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Real-World System Design Case Studies",
  description:
    "Study system design case studies from Google, Amazon, Stripe, Discord and more. Read original engineering sources, then practise their trade-offs in free interactive exercises.",
  path: "/companies",
});

export default function CompaniesPage() {
  const companies = listCompanies().map((company) => {
    const writeups = writeupsByCompany(company.id);
    const practise = [...new Set(writeups.flatMap((w) => w.investigationIds))].flatMap((id) => {
      const inv = getInvestigation(id);
      return inv ? [inv] : [];
    });
    return { company, practise };
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
      <PageHeader title="Real-world system design case studies">
        Study how engineers at Google, Amazon, Meta, Stripe, Discord, and other teams describe systems they built. Each
        case study links to its primary source and a free interactive exercise where you practise the same design
        trade-offs.
      </PageHeader>
      <section aria-labelledby="practice-method" className="mt-6 max-w-[72ch]">
        <h2 id="practice-method" className="font-display text-[1.25rem] leading-tight">
          How to use these case studies for interview practice
        </h2>
        <ol className="mt-3 grid gap-3 sm:grid-cols-3">
          {[
            ["Read the source", "Start with the engineers' paper, post, talk, or code—not a secondhand summary."],
            ["Name the trade-off", "Write down the constraint, the mechanism chosen, and the cost that choice accepts."],
            ["Practise the reasoning", "Work through a related system design exercise before reading its reference answer."],
          ].map(([title, text], index) => (
            <li key={title} className="sheet px-4 py-3">
              <p className="kicker">Step {index + 1}</p>
              <h3 className="mt-1 text-[0.9375rem] font-medium">{title}</h3>
              <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-2">{text}</p>
            </li>
          ))}
        </ol>
      </section>
      <section aria-label="All companies" className="mt-6 pb-10">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {companies.map(({ company, practise }) => (
            <li key={company.id} className="min-w-0">
              <Link href={`/companies/${company.id}`} className="sheet group flex h-full flex-col overflow-hidden">
                {practise[0] && (
                  <span className="dotgrid flex h-24 items-center justify-center border-b border-rule-soft px-6 py-3" aria-hidden="true">
                    <SystemThumb
                      className="max-h-full"
                      components={practise[0].system.components}
                      flows={practise[0].system.flows}
                      given={visibleAfter(practise[0], 0).components}
                    />
                  </span>
                )}
                <span className="flex flex-1 flex-col px-4 pt-3 pb-3.5">
                  <span className="text-[0.75rem] font-medium text-ink-3">{company.name}</span>
                  <span className="mt-0.5 text-[0.9375rem] font-medium leading-snug transition-colors group-hover:text-accent">
                    {company.topic}
                  </span>
                  <span className="mt-1.5 line-clamp-3 text-[0.8125rem] leading-relaxed text-ink-2">{company.summary}</span>
                  {practise[0] && (
                    <span className="mt-auto block pt-3">
                      <span className="block truncate border-t border-rule-soft pt-2.5 text-[0.75rem] text-ink-3">
                        Practise it: <span className="text-ink-2">{practise[0].title}</span>
                      </span>
                    </span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="question-claims" className="max-w-[72ch] border-t border-rule py-6">
        <h2 id="question-claims" className="font-display text-[1.125rem] leading-tight">
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
