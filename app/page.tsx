import Link from "next/link";
import { Suspense } from "react";
import { WELCOME_CREDITS } from "@/lib/domain/pricing";
import { ContinueStrip } from "@/components/continue-strip";
import { SystemExplorer } from "@/components/home/system-explorer";
import { DIFFICULTY } from "@/components/investigation/difficulty";
import { InlineText } from "@/components/prose-core";
import { CanceledNote } from "@/components/pricing/canceled-note";
import { PricingFaq } from "@/components/pricing/faq";
import { PricingTable } from "@/components/pricing/pricing-table";
import { SystemMap } from "@/components/system-map";
import { SystemThumb } from "@/components/system-thumb";
import { getConcept, getInvestigation, listCompanies, listInvestigations, writeupsByCompany } from "@/lib/content";
import { visibleAfter } from "@/lib/domain/visibility";
import { itemList, jsonLd } from "@/lib/metadata";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

type LogLine = { at: string; who: string; what: string; failed?: boolean };

/**
 * The moment the product is about: a real system, mid-failure, waiting for your reasoning.
 * The preferred scene comes with the log of what just happened; any other falls back to the event's own words.
 */
function heroScene() {
  const preferred = getInvestigation("video-processing-pipeline");
  const index = preferred?.stages.findIndex((s) => s.id === "worker-dies-mid-job") ?? -1;
  if (preferred && index >= 0) {
    const log: LogLine[] = [
      { at: "12:04:31", who: "deploy", what: "replacing worker containers" },
      { at: "12:04:31", who: "worker-3", what: "SIGTERM, 30 s grace" },
      { at: "12:05:01", who: "worker-3", what: "killed", failed: true },
      { at: "12:05:01", who: "job 812", what: "running · owner=worker-3" },
    ];
    return { investigation: preferred, index, failed: "workers", log };
  }
  for (const investigation of listInvestigations()) {
    const i = investigation.stages.findIndex((s) => s.event?.kind === "failure");
    if (i >= 0) return { investigation, index: i, failed: undefined, log: [] as LogLine[] };
  }
  return null;
}

/** Each step's light: red where the system breaks, amber where the load or the brief changes. */
const LOOP = [
  {
    step: "Learn",
    text: "Short explanations, each with a check that answers straight away.",
    led: "led-accent",
    tone: "bg-accent-solid",
  },
  {
    step: "Decide",
    text: "Choose between designs that all sound plausible.",
    led: "led-accent",
    tone: "bg-accent-solid",
  },
  {
    step: "Break it",
    text: "A worker dies, a message arrives twice, a request times out.",
    led: "led-gap",
    tone: "bg-mark-gap",
  },
  {
    step: "Change it",
    text: "Ten times the traffic, or a requirement from sales.",
    led: "led-partial",
    tone: "bg-mark-partial",
  },
  {
    step: "Defend it",
    text: "Say what the design guarantees, and where it stops.",
    led: "led-strong",
    tone: "bg-mark-strong",
  },
];

const pad = (n: number) => String(n).padStart(2, "0");

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
  const first = investigations[0];
  const scene = heroScene();
  const stage = scene?.investigation.stages[scene.index];
  const visible = scene ? visibleAfter(scene.investigation, scene.index) : null;
  const decision = stage?.interaction.kind === "decision" ? stage.interaction : null;
  const stageHref = scene && stage ? `/investigations/${scene.investigation.id}/${stage.id}` : "/investigations";
  const failed = scene?.failed && visible?.components.has(scene.failed) ? scene.failed : undefined;

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
      <section aria-labelledby="hero" className="relative isolate pt-10 sm:pt-14">
        <div className="light-cool" aria-hidden="true" />
        <div className="rise grid gap-x-14 gap-y-10 lg:grid-cols-[minmax(0,1fr)_27rem] lg:items-end">
          <div>
            {scene && (
              <p className="kicker flex items-center gap-2.5">
                <span className="led led-gap led-pulse" aria-hidden="true" />
                Live<span className="hidden sm:inline"> · {scene.investigation.id}</span> · stage {pad(scene.index + 1)}{" "}
                of {pad(scene.investigation.stages.length)}
              </p>
            )}
            <h1
              id="hero"
              className="mt-5 max-w-[17ch] font-display text-[clamp(2.5rem,1.3rem+3vw,3.75rem)] leading-[1.02] tracking-[-0.03em] text-balance"
            >
              Every system breaks. Learn <span className="lit">why</span> before the interviewer asks.
            </h1>
            <p className="mt-5 max-w-[52ch] text-[1.0625rem] leading-relaxed text-ink-2 text-pretty">
              Design real systems one decision at a time. Then a worker dies, a message arrives twice, traffic goes up
              ten times, and you defend what is left.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-2.5">
              {first && (
                <Link href={`/investigations/${first.id}`} className="btn btn-accent btn-lg">
                  Start the first system
                </Link>
              )}
              <Link href="/investigations" className="btn btn-secondary btn-lg">
                Browse all {investigations.length}
              </Link>
            </div>
          </div>

          {scene && stage?.event && (
            <aside aria-label="A failure, waiting for your reasoning" className="ticket">
              <p className="flex items-center justify-between gap-3 font-mono text-[0.6875rem] tracking-[0.08em] uppercase">
                <span className="text-signal-gap">Failure · stage {pad(scene.index + 1)}</span>
                {scene.log.length > 0 && <span className="text-ink-3">{scene.log[scene.log.length - 1]?.at}</span>}
              </p>
              <p className="mt-2.5 font-display text-[1.1875rem] leading-snug tracking-[-0.01em]">
                <InlineText text={stage.event.title} />
              </p>
              {scene.log.length > 0 ? (
                <div className="ticket-log mt-3" role="log" aria-label="What just happened">
                  {scene.log.map((line, i) => (
                    <div key={i} className={line.failed ? "text-signal-gap" : undefined}>
                      <span className={line.failed ? undefined : "text-ink-2"}>{line.at}</span> {line.who} {line.what}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-2">
                  <InlineText text={stage.event.detail} />
                </p>
              )}
              {decision && (
                <>
                  <p className="mt-4 text-[0.875rem] font-medium">{decision.prompt}</p>
                  <ul className="mt-2 border-b border-rule-soft">
                    {decision.options.slice(0, 3).map((option) => (
                      <li key={option.id}>
                        <Link href={stageHref} className="ticket-option">
                          <i aria-hidden="true" />
                          <InlineText text={option.label} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <div className="mt-3.5 text-[0.8125rem] font-medium">
                <Link href={stageHref} className="group inline-flex items-center gap-1 text-signal-gap">
                  Reason through it
                  <span className="transition-transform group-hover:translate-x-0.5" aria-hidden="true">
                    →
                  </span>
                </Link>
              </div>
            </aside>
          )}
        </div>

        {scene && visible && (
          <figure
            className="relative mt-6 [--lead-above:1.5rem] lg:mt-6"
            aria-label={`${scene.investigation.title}, while it is failing`}
          >
            <div className="matrix-lit" aria-hidden="true" />
            {/* On a phone the diagram keeps a readable size and scrolls sideways. */}
            <div className="max-sm:-mx-5 max-sm:overflow-x-auto max-sm:px-5 max-sm:pb-2">
            <div className="max-sm:w-[42rem]">
            <SystemMap
              bare
              compact
              live
              label={`${scene.investigation.title}: the system when this failure happens`}
              components={scene.investigation.system.components}
              flows={scene.investigation.system.flows}
              visibleComponents={[...visible.components]}
              visibleFlows={[...visible.flows]}
              failedComponents={failed ? [failed] : []}
              leadUpFrom={failed}
            />
            </div>
            </div>
          </figure>
        )}
      </section>

      <ContinueStrip investigations={outlines} />

      <section aria-labelledby="systems" className="mt-24 sm:mt-32">
        <div className="max-w-2xl">
          <h2
            id="systems"
            className="font-display text-[clamp(1.875rem,1.4rem+1.4vw,2.625rem)] leading-[1.05] tracking-[-0.025em] text-balance"
          >
            {investigations.length} systems. All of them breakable.
          </h2>
          <p className="mt-4 text-[0.9375rem] leading-relaxed text-ink-2 text-pretty">
            Each starts from requirements and the numbers. The parts the scenario gives you are already drawn; you
            design the rest, then it fails.
          </p>
        </div>
        <SystemExplorer
          systems={investigations.map((inv) => ({
            id: inv.id,
            title: inv.title,
            premise: inv.premise,
            meta: `${DIFFICULTY[inv.difficulty].toLowerCase()} · ${inv.estimatedMinutes} min · ${inv.stages.length} stages`,
            minutes: inv.estimatedMinutes,
            firstStageId: inv.stages[0]?.id ?? "",
            components: inv.system.components,
            flows: inv.system.flows,
          }))}
        />
      </section>

      <section aria-labelledby="loop" className="mt-24 sm:mt-32">
        <div className="max-w-2xl">
          <h2
            id="loop"
            className="font-display text-[clamp(1.875rem,1.4rem+1.4vw,2.625rem)] leading-[1.05] tracking-[-0.025em] text-balance"
          >
            Every system runs the same loop.
          </h2>
          <p className="mt-4 text-[0.9375rem] leading-relaxed text-ink-2 text-pretty">
            Choices are checked against a key. Written answers you mark yourself, against specific points. Nothing is a
            quiz for its own sake: each step changes the system you are building.
          </p>
        </div>
        <ol className="mt-12 grid gap-y-8 sm:grid-cols-2 lg:grid-cols-5">
          {LOOP.map((item) => (
            <li key={item.step} className="relative min-w-0 pt-6 pr-6">
              <span className="absolute inset-x-0 top-0 h-px bg-rule" aria-hidden="true" />
              <span className={`absolute top-0 left-0 h-px w-10 ${item.tone}`} aria-hidden="true" />
              <p className="flex items-center gap-2.5 font-display text-[1.125rem] tracking-[-0.01em]">
                <span className={`led ${item.led}`} aria-hidden="true" />
                {item.step}
              </p>
              <p className="mt-2 max-w-[28ch] text-[0.875rem] leading-relaxed text-ink-2">{item.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="sources" className="mt-24 sm:mt-32">
        <div className="flex flex-wrap items-end justify-between gap-x-16 gap-y-4">
          <div className="max-w-2xl">
            <h2
              id="sources"
              className="font-display text-[clamp(1.875rem,1.4rem+1.4vw,2.625rem)] leading-[1.05] tracking-[-0.025em] text-balance"
            >
              Built from what their engineers published.
            </h2>
            <p className="mt-4 text-[0.9375rem] leading-relaxed text-ink-2 text-pretty">
              Every system starts from a real writeup. Read theirs, then build yours and watch it break.
            </p>
          </div>
          <Link href="/companies" className="link text-[0.875rem]">
            All {companies.length} companies
          </Link>
        </div>
        <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sources.map(({ company, writeup, system }, i) => (
            <li key={company.id} className={i === 0 ? "sm:col-span-2 lg:row-span-2" : ""}>
              <article className="sheet group relative flex h-full flex-col overflow-hidden">
                {system && (
                  <div
                    className={`dotgrid flex items-center justify-center border-b border-rule-soft px-6 py-4 ${i === 0 ? "h-56" : "h-28"}`}
                    aria-hidden="true"
                  >
                    {i === 0 ? (
                      <div className="w-full max-w-[34rem]">
                        <SystemMap
                          bare
                          compact
                          live
                          hideDetails
                          label={`${system.title}: the finished architecture`}
                          components={system.system.components}
                          flows={system.system.flows}
                        />
                      </div>
                    ) : (
                      <SystemThumb
                        className="max-h-full"
                        components={system.system.components}
                        flows={system.system.flows}
                        given={visibleAfter(system, 0).components}
                      />
                    )}
                  </div>
                )}
                <div className={`flex flex-1 flex-col ${i === 0 ? "p-6" : "px-4 pt-3.5 pb-4"}`}>
                  <p className="flex items-center justify-between gap-3 text-[0.75rem] text-ink-3">
                    <span className="font-medium text-ink-2">{company.name}</span>
                    <span className="font-mono">{writeup.published.slice(0, 4)}</span>
                  </p>
                  <h3
                    className={`mt-2 font-display leading-snug tracking-[-0.01em] text-balance ${i === 0 ? "text-[1.625rem]" : "text-[1.0625rem]"}`}
                  >
                    <a href={writeup.url} target="_blank" rel="noopener noreferrer" className="hover:text-accent">
                      &ldquo;{writeup.title}&rdquo;
                    </a>
                  </h3>
                  <p className={`mt-2 leading-relaxed text-ink-2 ${i === 0 ? "text-[0.9375rem]" : "line-clamp-2 text-[0.8125rem]"}`}>
                    {i === 0 ? writeup.note : company.summary}
                  </p>
                  {i === 0 && (
                    <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="What it teaches">
                      {writeup.conceptIds.flatMap((id) => {
                        const concept = getConcept(id);
                        return concept
                          ? [
                              <li key={id}>
                                <Link href={`/concepts/${id}`} className="chip-flat hover:text-ink">
                                  {concept.title}
                                </Link>
                              </li>,
                            ]
                          : [];
                      })}
                    </ul>
                  )}
                  {system && (
                    <div className="mt-auto pt-4">
                      <Link
                        href={`/investigations/${system.id}`}
                        className="flex items-center gap-2 border-t border-rule-soft pt-3 text-[0.8125rem] text-ink-3 hover:text-ink"
                      >
                        Build it:
                        <span className="min-w-0 flex-1 truncate text-ink">{system.title}</span>
                        <span aria-hidden="true">→</span>
                      </Link>
                    </div>
                  )}
                </div>
              </article>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="pricing" className="mt-24 mb-8 sm:mt-32">
        <div className="flex flex-wrap items-end justify-between gap-x-16 gap-y-4">
          <div className="max-w-2xl">
            <h2
              id="pricing"
              className="font-display text-[clamp(1.875rem,1.4rem+1.4vw,2.625rem)] leading-[1.05] tracking-[-0.025em] text-balance"
            >
              Free to learn. Pay only for the AI.
            </h2>
            <p className="mt-4 text-[0.9375rem] leading-relaxed text-ink-2 text-pretty">
              Every system, concept and mock interview is free, with no account. Credits are one-time packs for AI
              drafts, reviews and question sets. They never expire, and a failed run gives them back.
            </p>
          </div>
        </div>
        <div className="mt-10">
          <Suspense fallback={null}>
            <CanceledNote />
          </Suspense>
          <PricingTable />
          <p className="mt-3 text-[0.75rem] text-ink-3">
            A verified account starts with {WELCOME_CREDITS} welcome credits, once. Payments by Dodo Payments; prices
            include applicable taxes where shown.
          </p>
        </div>

        <div id="faq" className="mx-auto mt-24 max-w-[46rem] scroll-mt-28">
          <div className="text-center">
            <h3 className="font-display text-[clamp(1.5rem,1.25rem+0.8vw,1.875rem)] leading-tight tracking-[-0.02em]">
              Questions
            </h3>
            <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-3">
              The{" "}
              <Link href="/legal/refunds" className="link font-normal">
                refunds page
              </Link>{" "}
              and the{" "}
              <Link href="/ai" className="link font-normal">
                AI page
              </Link>{" "}
              have the details.
            </p>
          </div>
          <div className="mt-8">
            <PricingFaq />
          </div>
        </div>
      </section>
    </div>
  );
}
