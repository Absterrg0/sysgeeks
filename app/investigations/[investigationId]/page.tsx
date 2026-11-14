import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContinueLink, InvestigationProgress, StageOutline, type StageLink } from "@/components/investigation/progress";
import { Prose } from "@/components/prose";
import { DIFFICULTY } from "@/components/investigation/difficulty";
import { ShareButton } from "@/components/share";
import { SystemMap } from "@/components/system-map";
import { DashList } from "@/components/page-header";
import { DotArrow } from "@/components/icons";
import { ReferenceCanvas } from "@/components/investigation/reference-canvas";
import { playModelOf, simulate } from "@/lib/domain/playground";
import { missionsFor } from "@/lib/content/scenarios";
import { getCompany, getConcept, getInvestigation, listInvestigations, writeupsForInvestigation } from "@/lib/content";
import { DESIGN_ROUND_MINUTES } from "@/lib/domain/design-round";
import { breadcrumbs, clipDescription, jsonLd, pageMetadata, systemNameForTitle } from "@/lib/metadata";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { PLAYGROUNDS } from "@/lib/content/playground";

export function generateStaticParams() {
  return listInvestigations().map((inv) => ({ investigationId: inv.id }));
}

export const dynamicParams = false;

export async function generateMetadata(props: PageProps<"/investigations/[investigationId]">): Promise<Metadata> {
  const { investigationId } = await props.params;
  const inv = getInvestigation(investigationId);
  if (!inv) return {};
  const systemName =
    inv.id === "shard-live-database"
      ? "Postgres Sharding"
      : systemNameForTitle(inv.searchTitle).replace(/ System$/, "");
  return pageMetadata({
    title:
      inv.id === "shard-live-database"
        ? "Postgres Sharding System Design Interview"
        : inv.id === "news-feed"
        ? "Twitter System Design Interview: Home Timeline"
        : inv.id === "file-storage-sync"
          ? "Dropbox System Design Interview: File Sync Practice"
          : `${systemName}: System Design Interview`,
    description: clipDescription(
      inv.id === "url-shortener"
        ? "Practice a Bitly-style URL shortener system design interview: estimate traffic, choose IDs, and test caching, click analytics, and urgent takedowns."
        : inv.id === "shard-live-database"
          ? "Free interactive Postgres sharding interview practice. Choose a workspace key, plan a live backfill, verify the copy, and schedule a controlled cutover."
        : inv.id === "news-feed"
          ? "Practice a Twitter/X system design interview: choose timeline fan-out, handle celebrity accounts, and reason through freshness, deletes, and failures."
          : inv.id === "file-storage-sync"
            ? "Free Dropbox system design interview practice: design resumable uploads, offline sync, conflict handling, and safe cleanup, then read a sourced walkthrough."
            : `Free interactive system design practice: ${inv.searchTitle}. Make design choices, test failure cases, and read the worked answer.`,
    ),
    path: `/investigations/${inv.id}`,
    imagePath: `/investigations/${inv.id}/opengraph-image`,
  });
}

const H2 = "text-[1.375rem] leading-[1.2] font-semibold tracking-[-0.025em]";

export default async function InvestigationPage(props: PageProps<"/investigations/[investigationId]">) {
  const { investigationId } = await props.params;
  const inv = getInvestigation(investigationId);
  if (!inv) notFound();

  const stages: StageLink[] = inv.stages.map((s) => ({ id: s.id, title: s.title, phase: s.phase }));
  const prerequisites = inv.prerequisites.flatMap((id) => {
    const c = getConcept(id);
    return c ? [c] : [];
  });
  const related = inv.relatedInvestigationIds.flatMap((id) => {
    const r = getInvestigation(id);
    return r ? [r] : [];
  });
  const sources = writeupsForInvestigation(inv.id);
  const missions = missionsFor(inv.id).length;
  const workload = PLAYGROUNDS[inv.id];
  const model = workload ? playModelOf(inv.system, workload) : undefined;
  const reference = model && workload ? { model, sim: simulate(model, workload, 1) } : undefined;
  const companies = [...new Set(sources.map((w) => w.companyId))].flatMap((id) => {
    const c = getCompany(id);
    return c ? [c] : [];
  });

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@graph": [
              breadcrumbs([
                { name: "System design interview questions", path: "/investigations" },
                { name: inv.searchTitle, path: `/investigations/${inv.id}` },
              ]),
              {
                "@type": "LearningResource",
                "@id": `${SITE_URL}/investigations/${inv.id}#resource`,
                name: `${inv.searchTitle}: ${inv.title}`,
                description: inv.premise,
                url: `${SITE_URL}/investigations/${inv.id}`,
                learningResourceType: "Interactive exercise",
                author: { "@id": `${SITE_URL}/#organization` },
                educationalLevel: inv.difficulty,
                timeRequired: `PT${inv.estimatedMinutes}M`,
                teaches: inv.competencies.map((c) => c.label),
                isAccessibleForFree: true,
                inLanguage: "en",
                provider: { "@id": `${SITE_URL}/#organization` },
                hasPart: inv.stages.map((st) => ({
                  "@type": "LearningResource",
                  name: st.title,
                  url: `${SITE_URL}/investigations/${inv.id}/${st.id}`,
                })),
                citation: sources.map((w) => ({ "@type": "CreativeWork", name: w.title, url: w.url })),
              },
            ],
          }),
        }}
      />
      <header className="pt-8 sm:pt-12">
        <p className="text-[0.8125rem] text-ink-3">
          <Link href="/investigations" className="transition-colors hover:text-ink">
            Systems
          </Link>
          <span className="mx-1.5 text-rule-strong">/</span>
          {inv.title}
        </p>
        <h1 className="mt-3 max-w-[22ch] text-[clamp(2rem,1.6rem+1.4vw,2.75rem)] leading-[1.05] font-semibold tracking-[-0.035em] text-balance">
          {inv.searchTitle}
        </h1>
        <p className="mt-4 max-w-[40rem] text-[1.0625rem] leading-relaxed text-ink-2 text-pretty">{inv.premise}</p>
        <dl className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.8125rem] text-ink-3">
          {[
            { label: "Level", value: DIFFICULTY[inv.difficulty] },
            { label: "Time", value: `about ${inv.estimatedMinutes} min` },
            { label: "Stages", value: String(inv.stages.length) },
            ...(missions > 0 ? [{ label: "Missions", value: String(missions) }] : []),
          ].map((m) => (
            <div key={m.label} className="flex items-baseline gap-1.5">
              <dt>{m.label}</dt>
              <dd className="font-medium text-ink">{m.value}</dd>
            </div>
          ))}
          <div className="flex items-baseline gap-1.5">
            <dt className="sr-only">Author</dt>
            <dd>By SysGeeks</dd>
          </div>
        </dl>
        <div className="mt-7 flex flex-wrap items-center gap-2.5">
          <ContinueLink investigationId={inv.id} stages={stages} />
          {PLAYGROUNDS[inv.id] && (
            <Link href={`/investigations/${inv.id}/playground`} className="btn btn-secondary btn-lg">
              Open the playground
            </Link>
          )}
          <ShareButton
            url={`${SITE_URL}/investigations/${inv.id}`}
            title={`${inv.searchTitle} · ${SITE_NAME}`}
            text={`${inv.searchTitle}, worked through like a real system design interview.`}
          />
        </div>
      </header>

      <div className="mt-12 grid gap-x-12 gap-y-12 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0">
          <figure className="sheet m-0 overflow-hidden" aria-label={`${inv.title}: the finished architecture, running`}>
            <figcaption className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-rule-soft px-4 py-3 sm:px-5">
              <span className="flex items-center gap-2.5 text-[0.875rem] font-medium">
                <span className="led led-strong led-pulse" aria-hidden="true" />
                The finished design
                <span className="font-normal text-ink-3">{reference ? "at average traffic" : "each stage adds a part"}</span>
              </span>
              {PLAYGROUNDS[inv.id] && (
                <Link
                  href={`/investigations/${inv.id}/playground`}
                  className="group inline-flex items-center gap-2 text-[0.8125rem] font-medium text-ink-2 transition-colors hover:text-ink"
                >
                  Break it in the playground
                  <DotArrow />
                </Link>
              )}
            </figcaption>
            {reference ? (
              <ReferenceCanvas
                model={reference.model}
                sim={reference.sim}
                label={`${inv.title}: the finished architecture at average traffic`}
              />
            ) : (
              <div className="dotgrid px-3 py-6 max-sm:overflow-x-auto sm:px-8">
                <div className="max-sm:w-[38rem]">
                  <SystemMap
                    bare
                    compact
                    live
                    label={`${inv.title}: the finished architecture`}
                    components={inv.system.components}
                    flows={inv.system.flows}
                  />
                </div>
              </div>
            )}
          </figure>

          <section aria-labelledby="scenario" className="mt-16">
            <h2 id="scenario" className={H2}>
              The situation
            </h2>
            <div className="mt-4 max-w-[42rem] text-[1.0625rem] leading-relaxed">
              <Prose text={inv.scenario} />
            </div>
          </section>

          <section aria-labelledby="requirements" className="mt-16">
            <h2 id="requirements" className={H2}>
              What it has to do
            </h2>
            <div className="sheet mt-5 overflow-hidden">
              <div className="grid sm:grid-cols-2">
                <div className="px-5 py-5 sm:px-6">
                  <h3 className="kicker mb-3">Functional</h3>
                  <DashList items={inv.requirements.functional} />
                </div>
                <div className="border-t border-rule-soft px-5 py-5 sm:border-t-0 sm:border-l sm:px-6">
                  <h3 className="kicker mb-3">Non-functional</h3>
                  <DashList items={inv.requirements.nonFunctional} />
                </div>
              </div>
              <div className="border-t border-rule-soft bg-[color-mix(in_srgb,var(--ink)_2%,var(--raised))] px-5 py-5 sm:px-6">
                <h3 className="kicker mb-3">Constraints and assumptions</h3>
                <DashList items={[...inv.constraints, ...inv.assumptions]} muted />
              </div>
            </div>
          </section>

          <section aria-labelledby="variants" className="mt-16">
            <h2 id="variants" className={H2}>
              The questions it prepares you for
            </h2>
            <ul className="sheet mt-5 overflow-hidden">
              {inv.interviewVariants.map((v) => (
                <li key={v} className="sheet-row px-5 py-4 text-[1rem] leading-snug sm:px-6">
                  <span className="text-ink-3" aria-hidden="true">“</span>
                  {v}
                  <span className="text-ink-3" aria-hidden="true">”</span>
                </li>
              ))}
            </ul>
            {inv.id === "news-feed" && (
              <p className="mt-4 max-w-[60ch] text-[0.875rem] leading-relaxed text-ink-2">
                For a ranked Instagram home feed, read the{" "}
                <Link href="/system-design-interview/design-instagram-feed" className="link">
                  source-based design walkthrough
                </Link>
                . This exercise focuses on the public Twitter timeline system described above.
              </p>
            )}
          </section>

          {(companies.length > 0 || prerequisites.length > 0 || related.length > 0) && (
            <section aria-labelledby="more" className="mt-16">
              <h2 id="more" className={H2}>
                Read and practise next
              </h2>
              <div className="sheet mt-5 grid overflow-hidden text-[0.875rem] leading-relaxed sm:grid-cols-3">
                {[
                  companies.length > 0 && (
                    <div key="sources" className="px-5 py-5">
                      <h3 className="kicker">From the source</h3>
                      <ul className="mt-3 space-y-3">
                        {companies.map((c) => (
                          <li key={c.id}>
                            <Link href={`/companies/${c.id}`} className="font-medium transition-colors hover:text-ink-2">
                              How {c.name} built it
                            </Link>
                            <span className="block text-[0.8125rem] text-ink-3">{c.topic}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ),
                  prerequisites.length > 0 && (
                    <div key="concepts" className="px-5 py-5">
                      <h3 className="kicker">Concepts to know first</h3>
                      <ul className="mt-3 space-y-2">
                        {prerequisites.map((c) => (
                          <li key={c.id}>
                            <Link href={`/concepts/${c.id}`} className="text-ink-2 transition-colors hover:text-ink">
                              {c.title}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ),
                  related.length > 0 && (
                    <div key="related" className="px-5 py-5">
                      <h3 className="kicker">Similar systems</h3>
                      <ul className="mt-3 space-y-2">
                        {related.map((r) => (
                          <li key={r.id}>
                            <Link href={`/investigations/${r.id}`} className="text-ink-2 transition-colors hover:text-ink">
                              {r.searchTitle}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ),
                ]
                  .filter(Boolean)
                  .map((col, i) => (
                    <div key={i} className={i > 0 ? "border-t border-rule-soft sm:border-t-0 sm:border-l" : ""}>
                      {col}
                    </div>
                  ))}
              </div>
            </section>
          )}
        </div>

        <aside aria-labelledby="stages">
          <div className="sheet overflow-hidden lg:sticky lg:top-36">
            <div className="border-b border-rule-soft px-5 pt-4 pb-3.5">
              <div className="flex items-baseline justify-between gap-4">
                <h2 id="stages" className="text-[1rem] font-semibold tracking-[-0.015em]">
                  Stages
                </h2>
                <InvestigationProgress investigationId={inv.id} stages={stages} />
              </div>
              <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-3">
                Each teaches what you need, then asks you to decide.
              </p>
            </div>
            <div className="px-3 py-3">
              <StageOutline investigationId={inv.id} stages={stages} withPhase withReview />
            </div>
            <p className="border-t border-rule-soft px-5 py-3.5 text-[0.8125rem] leading-relaxed text-ink-3">
              Ready to drive it yourself?{" "}
              <Link href={`/investigations/${inv.id}/design`} className="link font-normal">
                Do it as a {DESIGN_ROUND_MINUTES}-minute round
              </Link>{" "}
              from a blank page.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
