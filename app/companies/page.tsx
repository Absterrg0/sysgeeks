import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { SystemThumb } from "@/components/system-thumb";
import { visibleAfter } from "@/lib/domain/visibility";
import { getInvestigation, listCompanies, writeupsByCompany } from "@/lib/content";
import { itemList, jsonLd, pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata({
  title: "How Real Companies Do System Design",
  description:
    "How Stripe, Discord, Figma, Uber, Slack and others solved real system design problems, in their engineers' own words, with a system to practise each on.",
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
            itemList(
              "How real companies do system design",
              companies.map(({ company }) => ({ name: `${company.name}: ${company.topic}`, path: `/companies/${company.id}` })),
            ),
          ),
        }}
      />
      <PageHeader title="How real companies do system design">
        One idea per company, from what their engineers published about it. Each page explains the idea, links to the
        original writing, and has an investigation to practise it.
      </PageHeader>
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
    </div>
  );
}
