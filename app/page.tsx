import Link from "next/link";
import { DeferredContinueStrip } from "@/components/home/deferred-continue-strip";
import { DIFFICULTY } from "@/components/investigation/difficulty";
import { DotArrow } from "@/components/icons";
import { Playground } from "@/components/playground/playground";
import { PracticeEntryLink } from "@/components/practice-entry-link";
import { SystemThumb } from "@/components/system-thumb";
import { visibleAfter } from "@/lib/domain/visibility";
import { getInvestigation, listCompanies, listInvestigations, writeupsByCompany } from "@/lib/content";
import { PLAYGROUNDS } from "@/lib/content/playground";
import { playgroundProps } from "@/lib/content/playground-props";
import { missionsFor } from "@/lib/content/scenarios";
import { itemList, jsonLd } from "@/lib/metadata";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

const H2 = "text-[clamp(1.5rem,1.2rem+1vw,2.125rem)] leading-[1.08] font-semibold tracking-[-0.035em] text-balance";

/** The home page's system: the one most people know, so the first minute is about breaking it, not reading it. */
const HOME_SYSTEM = "url-shortener";

export default function Home() {
  const investigations = listInvestigations();
  const outlines = investigations.map((inv) => ({
    id: inv.id,
    title: inv.title,
    stages: inv.stages.map((s) => ({ id: s.id, title: s.title, phase: s.phase })),
  }));
  const companies = listCompanies();
  // One writeup per company, the most recent first in each, led by the company whose story is the richest.
  const LEAD = ["discord", "stripe", "cloudflare", "slack", "mux", "figma"];
  const sources = LEAD.flatMap((id) => {
    const company = companies.find((c) => c.id === id);
    const writeup = writeupsByCompany(id).sort((a, b) => b.published.localeCompare(a.published))[0];
    if (!company || !writeup) return [];
    const system = writeup.investigationIds.map((i) => getInvestigation(i)).find(Boolean);
    return [{ company, writeup, system }];
  });
  const play = playgroundProps(HOME_SYSTEM);
  const missionCount = investigations.reduce((n, inv) => n + missionsFor(inv.id).length, 0);
  const first = investigations[0];

  const STEPS = [
    {
      n: "01",
      title: "Break it",
      body: "A real system, running. Drag the traffic up, kill a database, empty a cache. Every number reacts.",
      href: `/investigations/${HOME_SYSTEM}/playground`,
      cta: "Open the playground",
    },
    {
      n: "02",
      title: "Beat a mission",
      body: `${missionCount} situations with a goal: survive 10× traffic, lose a machine, stay on budget. Checked live as you change the design.`,
      href: `/investigations/${HOME_SYSTEM}/playground`,
      cta: "Take a mission",
    },
    {
      n: "03",
      title: "Learn the design",
      body: "Make each decision before you see the reasoning, then read the full worked answer, sourced from the engineers who built it.",
      href: first ? `/investigations/${first.id}` : "/investigations",
      cta: "Start a system",
    },
    {
      n: "04",
      title: "Do the interview",
      body: "A timed 30, 45 or 60-minute round from a blank page, marked against the points an interviewer listens for.",
      href: "/system-design-mock-interview",
      cta: "Start a mock interview",
    },
  ];

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@graph": [
              {
                "@type": "WebApplication",
                "@id": `${SITE_URL}/#app`,
                name: SITE_NAME,
                url: SITE_URL,
                description: SITE_DESCRIPTION,
                applicationCategory: "EducationalApplication",
                operatingSystem: "Any (web browser)",
                isAccessibleForFree: true,
                publisher: { "@id": `${SITE_URL}/#organization` },
              },
              itemList(
                "System design interview questions",
                investigations.map((inv) => ({ name: inv.searchTitle, path: `/investigations/${inv.id}` })),
              ),
            ],
          }),
        }}
      />

      {play && (
        <Playground
          {...play}
          heading={{
            title: "System design interview practice on real systems.",
            lede: "Drag the traffic up until something breaks, then fix it. Every system is a real interview question, with missions, a worked answer and a timed mock round. Free, no account.",
          }}
        />
      )}

      <DeferredContinueStrip investigations={outlines} />

      <section aria-labelledby="how" className="mt-20 sm:mt-28">
        <div className="flex flex-wrap items-end justify-between gap-x-12 gap-y-3">
          <h2 id="how" className={H2}>
            From breaking it to explaining it.
          </h2>
          <p className="max-w-[28rem] text-[0.9375rem] leading-relaxed text-ink-2 text-pretty">
            Diagrams and rules of thumb do not tell you why p99 falls off a cliff. Watching it happen does. Then you
            practise saying it.
          </p>
        </div>
        <ol className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step) => (
            <li key={step.n} className="sheet flex flex-col p-5">
              <p className="font-mono text-[0.75rem] text-ink-3">{step.n}</p>
              <h3 className="mt-3 text-[1.0625rem] font-semibold tracking-[-0.02em]">{step.title}</h3>
              <p className="mt-1.5 text-[0.875rem] leading-relaxed text-ink-2">{step.body}</p>
              <Link
                href={step.href}
                className="group mt-auto inline-flex items-center gap-2 pt-5 text-[0.875rem] font-medium text-ink"
              >
                {step.cta}
                <DotArrow />
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="systems" className="mt-20 sm:mt-28">
        <div className="flex flex-wrap items-end justify-between gap-x-12 gap-y-3">
          <h2 id="systems" className={H2}>
            {investigations.length} systems. Each one a real interview question.
          </h2>
          <Link href="/investigations" className="group inline-flex items-center gap-2 text-[0.875rem] font-medium text-ink-2 hover:text-ink">
            All questions and answers
            <DotArrow />
          </Link>
        </div>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {investigations.map((inv) => {
            const missions = missionsFor(inv.id).length;
            const href = PLAYGROUNDS[inv.id] ? `/investigations/${inv.id}/playground` : `/investigations/${inv.id}`;
            return (
              <li key={inv.id} className="sheet group/sys relative flex min-w-0 flex-col overflow-hidden transition-shadow hover:shadow-[0_0_0_1px_var(--edge-strong),0_14px_32px_-16px_var(--drop-2)]">
                <div className="pg-canvas flex h-28 items-center justify-center border-b border-rule-soft px-6 py-4" aria-hidden="true">
                  <SystemThumb
                    className="max-h-full w-full max-w-[15rem] transition-transform duration-300 group-hover/sys:scale-[1.03]"
                    components={inv.system.components}
                    flows={inv.system.flows}
                    given={visibleAfter(inv, 0).components}
                  />
                </div>
                <div className="flex flex-1 flex-col px-4 pt-3.5 pb-4">
                  <PracticeEntryLink
                    href={href}
                    investigationId={inv.id}
                    source="home_explorer_playground"
                    className="text-[0.9375rem] leading-snug font-semibold tracking-[-0.015em] after:absolute after:inset-0"
                  >
                    {inv.title}
                  </PracticeEntryLink>
                  <p className="mt-1 text-[0.8125rem] text-ink-3">
                    {DIFFICULTY[inv.difficulty]} · {inv.estimatedMinutes} min
                    {missions > 0 && ` · ${missions} missions`}
                  </p>
                  <div className="relative z-10 mt-auto flex items-center gap-4 pt-3 text-[0.8125rem] font-medium">
                    <span className="inline-flex items-center gap-1.5 text-ink">
                      Play
                      <DotArrow />
                    </span>
                    <PracticeEntryLink
                      href={`/investigations/${inv.id}`}
                      investigationId={inv.id}
                      source="home_explorer_learn"
                      className="text-ink-3 transition-colors hover:text-ink"
                    >
                      Learn it
                    </PracticeEntryLink>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="sources" className="mt-24 mb-12 sm:mt-32">
        <div className="flex flex-wrap items-end justify-between gap-x-12 gap-y-3">
          <h2 id="sources" className={H2}>
            Built from what they published.
          </h2>
          <Link href="/companies" className="group inline-flex items-center gap-2 text-[0.875rem] font-medium text-ink-2 hover:text-ink">
            All {companies.length} companies
            <DotArrow />
          </Link>
        </div>
        <ul className="sheet mt-8 overflow-hidden">
          {sources.map(({ company, writeup, system }) => (
            <li
              key={company.id}
              className="sheet-row grid grid-cols-1 gap-x-6 gap-y-1 px-4 py-3.5 sm:grid-cols-[8rem_minmax(0,1fr)_auto] sm:items-center sm:px-5"
            >
              <p className="flex items-center gap-2 text-[0.8125rem]">
                <span className="font-medium">{company.name}</span>
                <span className="font-mono text-[0.75rem] text-ink-3">{writeup.published.slice(0, 4)}</span>
              </p>
              <a
                href={writeup.url}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 truncate text-[0.9375rem] text-ink-2 transition-colors hover:text-ink"
              >
                &ldquo;{writeup.title}&rdquo; <span aria-hidden="true">↗</span>
              </a>
              {system && (
                <Link
                  href={`/investigations/${system.id}`}
                  className="group inline-flex min-w-0 items-center gap-2 text-[0.8125rem] font-medium text-ink-2 hover:text-ink sm:whitespace-nowrap"
                >
                  <span className="shrink-0">Build it:</span>
                  <span className="min-w-0 truncate text-ink">{system.title}</span>
                  <DotArrow />
                </Link>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
