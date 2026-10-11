import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContinueLink, InvestigationProgress, StageOutline, type StageLink } from "@/components/investigation/progress";
import { Prose } from "@/components/prose";
import { DIFFICULTY } from "@/components/investigation/difficulty";
import { ShareButton } from "@/components/share";
import { SystemMap } from "@/components/system-map";
import { DashList, PageHeader } from "@/components/page-header";
import { getCompany, getConcept, getInvestigation, listInvestigations, writeupsForInvestigation } from "@/lib/content";
import { DESIGN_ROUND_MINUTES } from "@/lib/domain/design-round";
import { breadcrumbs, clip, jsonLd, pageMetadata, systemNameForTitle } from "@/lib/metadata";
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
      ? "Live Database Sharding"
      : systemNameForTitle(inv.searchTitle).replace(/ System$/, "");
  return pageMetadata({
    title:
      inv.id === "news-feed"
        ? "Twitter System Design Interview: Home Timeline"
        : inv.id === "file-storage-sync"
          ? "Dropbox System Design Interview: File Sync Practice"
          : `${systemName}: System Design Interview`,
    description: clip(
      inv.id === "url-shortener"
        ? "Practice a Bitly-style URL shortener system design interview: estimate traffic, choose IDs, and test caching, click analytics, and urgent takedowns."
        : inv.id === "news-feed"
          ? "Practice a Twitter/X system design interview: choose timeline fan-out, handle celebrity accounts, and reason through freshness, deletes, and failures."
          : inv.id === "file-storage-sync"
            ? "Free Dropbox system design interview practice: design resumable uploads, offline sync, conflict handling, and safe cleanup, then read a sourced walkthrough."
            : `Free interactive system design practice: ${inv.searchTitle}. Make design choices, test failure cases, and read the worked answer.`,
    ),
    path: `/investigations/${inv.id}`,
  });
}

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
      <PageHeader
        title={inv.searchTitle}
        eyebrow={
          <>
            <Link href="/investigations" className="hover:text-ink">
              Systems
            </Link>
            <span className="mx-1.5 text-rule-strong">/</span>
            {DIFFICULTY[inv.difficulty]} · about {inv.estimatedMinutes} min · {inv.stages.length} stages
          </>
        }
        actions={
          <>
            <ShareButton
              url={`${SITE_URL}/investigations/${inv.id}`}
              title={`${inv.searchTitle} · ${SITE_NAME}`}
              text={`${inv.searchTitle}, worked through like a real system design interview.`}
            />
            {PLAYGROUNDS[inv.id] && (
              <Link href={`/investigations/${inv.id}/playground`} className="btn btn-secondary">
                Break it in the playground
              </Link>
            )}
            <ContinueLink investigationId={inv.id} stages={stages} />
          </>
        }
      >
        {inv.premise}
      </PageHeader>

      <div className="mt-8 grid gap-x-12 gap-y-12 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0">
          <figure className="screen relative px-3 py-5 sm:px-8 sm:py-7" aria-label={`${inv.title}: the finished architecture, running`}>
            <div className="max-sm:overflow-x-auto">
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
            <figcaption className="mt-4 text-center text-[0.75rem] text-ink-3">
              The finished design. Each stage adds a part of it.
            </figcaption>
          </figure>

          <section aria-labelledby="scenario" className="mt-14">
            <h2 id="scenario" className="font-display text-[1.375rem] leading-tight tracking-[-0.015em]">
              The situation
            </h2>
            <div className="mt-5 max-w-[66ch]">
              <Prose text={inv.scenario} />
            </div>
          </section>

          <section aria-labelledby="requirements" className="mt-14">
            <h2 id="requirements" className="font-display text-[1.375rem] leading-tight tracking-[-0.015em]">
              What it has to do
            </h2>
            <div className="mt-6 grid gap-x-12 gap-y-8 sm:grid-cols-2">
              <div>
                <h3 className="kicker mb-4">Functional</h3>
                <DashList items={inv.requirements.functional} />
              </div>
              <div>
                <h3 className="kicker mb-4">Non-functional</h3>
                <DashList items={inv.requirements.nonFunctional} />
              </div>
            </div>
            <div className="mt-10 border-l-2 border-accent-solid/60 pl-6">
              <h3 className="kicker mb-4">Constraints and assumptions</h3>
              <DashList items={[...inv.constraints, ...inv.assumptions]} muted />
            </div>
          </section>

          <section aria-labelledby="variants" className="mt-14">
            <h2 id="variants" className="font-display text-[1.375rem] leading-tight tracking-[-0.015em]">
              The questions it prepares you for
            </h2>
            <ul className="mt-6 space-y-4">
              {inv.interviewVariants.map((v) => (
                <li
                  key={v}
                  className="max-w-[60ch] font-display text-[1.1875rem] leading-snug tracking-[-0.01em] text-ink-2"
                >
                  <span className="text-ink-3" aria-hidden="true">
                    “
                  </span>
                  {v}
                  <span className="text-ink-3" aria-hidden="true">
                    ”
                  </span>
                </li>
              ))}
            </ul>
            {inv.id === "news-feed" && (
              <p className="mt-5 max-w-[60ch] text-[0.875rem] leading-relaxed text-ink-2">
                For a ranked Instagram home feed, read the{" "}
                <Link href="/system-design-interview/design-instagram-feed" className="link">
                  source-based design walkthrough
                </Link>
                . This exercise focuses on the public Twitter timeline system described above.
              </p>
            )}
          </section>

          {(companies.length > 0 || prerequisites.length > 0 || related.length > 0) && (
            <section aria-labelledby="more" className="mt-14">
              <h2 id="more" className="font-display text-[1.375rem] leading-tight tracking-[-0.015em]">
                Read and practise next
              </h2>
              <div className="mt-5 grid gap-3 text-[0.875rem] leading-relaxed sm:grid-cols-3">
                {companies.length > 0 && (
                  <div className="sheet p-4">
                    <p className="sheet-label">From the source</p>
                    <ul className="mt-2 space-y-2.5">
                      {companies.map((c) => (
                        <li key={c.id}>
                          <Link href={`/companies/${c.id}`} className="font-medium hover:text-accent">
                            How {c.name} built it
                          </Link>
                          <span className="block text-[0.8125rem] text-ink-3">{c.topic}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {prerequisites.length > 0 && (
                  <div className="sheet p-4">
                    <p className="sheet-label">Concepts to know first</p>
                    <ul className="mt-2 space-y-1.5">
                      {prerequisites.map((c) => (
                        <li key={c.id}>
                          <Link href={`/concepts/${c.id}`} className="hover:text-accent">
                            {c.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {related.length > 0 && (
                  <div className="sheet p-4">
                    <p className="sheet-label">Similar systems</p>
                    <ul className="mt-2 space-y-1.5">
                      {related.map((r) => (
                        <li key={r.id}>
                          <Link href={`/investigations/${r.id}`} className="hover:text-accent">
                            {r.searchTitle}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>

        <aside aria-labelledby="stages">
          <div className="sheet p-5 lg:sticky lg:top-36">
            <div className="flex items-baseline justify-between gap-4">
              <h2 id="stages" className="font-display text-[1.25rem] tracking-[-0.015em]">
                Stages
              </h2>
              <InvestigationProgress investigationId={inv.id} stages={stages} />
            </div>
            <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-ink-3">
              Each teaches what you need, then asks you to decide.
            </p>
            <div className="mt-4 -mx-2">
              <StageOutline investigationId={inv.id} stages={stages} withPhase withReview />
            </div>
            <p className="mt-5 text-[0.8125rem] leading-relaxed text-ink-3">
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
