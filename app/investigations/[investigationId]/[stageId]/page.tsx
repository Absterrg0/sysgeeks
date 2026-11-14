import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buildSlots, Reveal } from "@/components/exercise/slots";
import { ExerciseWorkspace } from "@/components/exercise/workspace";
import { EventBanner } from "@/components/investigation/event-banner";
import { StageTrack } from "@/components/investigation/stage-track";
import { YourTurn } from "@/components/investigation/your-turn";
import { DotArrow } from "@/components/icons";
import { Lesson } from "@/components/lesson/lesson";
import { SystemMap } from "@/components/system-map";
import { Prose } from "@/components/prose";
import { getConcept, getStage, listInvestigations } from "@/lib/content";
import { PHASE_LABELS } from "@/lib/domain/content";
import { type ExerciseRef } from "@/lib/domain/learner";
import { visibleAfter } from "@/lib/domain/visibility";
import { breadcrumbs, clip, clipDescription, jsonLd, pageMetadata, systemNameForTitle } from "@/lib/metadata";
import { proseToPlainText } from "@/lib/prose";
import { SITE_URL } from "@/lib/site";

export function generateStaticParams() {
  return listInvestigations().flatMap((inv) =>
    inv.stages.map((stage) => ({ investigationId: inv.id, stageId: stage.id })),
  );
}

export const dynamicParams = false;

export async function generateMetadata(
  props: PageProps<"/investigations/[investigationId]/[stageId]">,
): Promise<Metadata> {
  const { investigationId, stageId } = await props.params;
  const found = getStage(investigationId, stageId);
  if (!found) return {};
  const { investigation, stage } = found;
  // Lead with the question the stage asks: it is what a searcher typed.
  const question = proseToPlainText(stage.interaction.prompt);
  const fullTitle = `${investigation.searchTitle}: ${stage.title}`;
  const systemName = systemNameForTitle(investigation.searchTitle);
  const suffix = ` | ${systemName}`;
  const title = fullTitle.length <= 55 ? fullTitle : `${clip(stage.title, 55 - suffix.length)}${suffix}`;
  return pageMetadata({
    title,
    description: clipDescription(
      stage.event
        ? `${proseToPlainText(stage.event.title)}. ${question} ${proseToPlainText(stage.event.detail)}`
        : `${question} ${proseToPlainText(stage.context)}`,
    ),
    path: `/investigations/${investigation.id}/${stage.id}`,
    imagePath: `/investigations/${investigation.id}/${stage.id}/opengraph-image`,
  });
}

export default async function StagePage(props: PageProps<"/investigations/[investigationId]/[stageId]">) {
  const { investigationId, stageId } = await props.params;
  const found = getStage(investigationId, stageId);
  if (!found) notFound();
  const { investigation, stage, index } = found;
  const ref: ExerciseRef = { kind: "stage", investigationId: investigation.id, stageId: stage.id };
  const systemName = systemNameForTitle(investigation.searchTitle);

  const previous = investigation.stages[index - 1];
  const next = investigation.stages[index + 1];
  const before = visibleAfter(investigation, index);
  const after = visibleAfter(investigation, index + 1);
  const added = {
    components: [...after.components].filter((id) => !before.components.has(id)),
    flows: [...after.flows].filter((id) => !before.flows.has(id)),
  };
  const concepts = stage.conceptIds.flatMap((id) => {
    const c = getConcept(id);
    return c ? [c] : [];
  });

  const reveal = (
    <div className="space-y-8">
      <Reveal reveal={stage.reveal} />
      {(added.components.length > 0 || added.flows.length > 0) && (
        <div>
          <h3 className="mb-3 text-[1rem] font-semibold tracking-[-0.015em]">The system now</h3>
          <SystemMap
            label={`${investigation.title}: system after stage ${index + 1}`}
            components={investigation.system.components}
            flows={investigation.system.flows}
            visibleComponents={[...after.components]}
            visibleFlows={[...after.flows]}
            highlightComponents={added.components}
            highlightFlows={added.flows}
          />
        </div>
      )}
      {concepts.length > 0 && (
        <div>
          <h3 className="mb-3 text-[1rem] font-semibold tracking-[-0.015em]">Concepts in this stage</h3>
          <ul className="sheet overflow-hidden">
            {concepts.map((c) => (
              <li key={c.id} className="sheet-row">
                <Link href={`/concepts/${c.id}`} className="group flex items-start gap-4 px-4 py-3 transition-colors hover:bg-hover sm:px-5">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.875rem] font-medium">{c.title}</span>
                    <span className="mt-0.5 block text-[0.8125rem] leading-relaxed text-ink-2">{c.summary}</span>
                  </span>
                  <span aria-hidden="true" className="mt-0.5 text-ink-3 transition-transform group-hover:translate-x-0.5 group-hover:text-ink">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  const workspace = (
    <ExerciseWorkspace
      key={stage.id}
      spec={{
        ref,
        interaction: stage.interaction,
        tags: { dimensions: stage.dimensions, conceptIds: stage.conceptIds, competencyIds: stage.competencyIds },
        title: stage.title,
        context: stage.context ?? null,
      }}
      slots={buildSlots(stage.interaction)}
      reveal={reveal}
      context="investigation"
      framed
    />
  );

  return (
    <article className="mx-auto max-w-[44rem]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@graph": [
              breadcrumbs([
                { name: "System design interview questions", path: "/investigations" },
                { name: investigation.searchTitle, path: `/investigations/${investigation.id}` },
                { name: stage.title, path: `/investigations/${investigation.id}/${stage.id}` },
              ]),
              {
                "@type": "LearningResource",
                name: `${investigation.searchTitle}: ${stage.title}`,
                description: proseToPlainText(stage.interaction.prompt),
                url: `${SITE_URL}/investigations/${investigation.id}/${stage.id}`,
                learningResourceType: "Practice problem",
                author: { "@id": `${SITE_URL}/#organization` },
                educationalLevel: investigation.difficulty,
                position: index + 1,
                isPartOf: { "@id": `${SITE_URL}/investigations/${investigation.id}#resource` },
                about: concepts.map((c) => ({ "@type": "DefinedTerm", name: c.title, url: `${SITE_URL}/concepts/${c.id}` })),
                isAccessibleForFree: true,
                inLanguage: "en",
                provider: { "@id": `${SITE_URL}/#organization` },
                // The worked answer to this stage, for engines that want the answer and not the exercise.
                subjectOf: {
                  "@type": "LearningResource",
                  name: `${investigation.searchTitle}: full walkthrough`,
                  url: `${SITE_URL}/investigations/${investigation.id}/review#stage-${stage.id}`,
                },
              },
            ],
          }),
        }}
      />
      <header className="rise pt-8 sm:pt-12">
        <div className="flex items-center justify-between gap-4 text-[0.8125rem] text-ink-3">
          <p>
            <Link href={`/investigations/${investigation.id}`} className="transition-colors hover:text-ink">
              {investigation.title}
            </Link>
          </p>
          <p className="shrink-0">
            Stage <span className="font-mono tabular-nums text-ink">{index + 1}</span>
            <span className="mx-0.5 text-rule-strong">/</span>
            <span className="font-mono tabular-nums">{investigation.stages.length}</span>
            <span className="mx-1.5 text-rule-strong">·</span>
            {PHASE_LABELS[stage.phase]}
          </p>
        </div>
        <div className="mt-2">
          <StageTrack
            investigationId={investigation.id}
            stages={investigation.stages.map((s) => ({ id: s.id, title: s.title }))}
            index={index}
          />
        </div>
        <h1 className="mt-6 text-[clamp(2rem,1.6rem+1.4vw,2.75rem)] leading-[1.05] font-semibold tracking-[-0.035em] text-balance">
          <span className="sr-only">{systemName}: </span>
          {stage.title}
        </h1>
        <p className="mt-3 text-[0.8125rem] text-ink-3">
          {systemName} · By SysGeeks
        </p>
      </header>

      <section aria-label="The situation" className="mt-8 space-y-5">
        {stage.event && <EventBanner event={stage.event} />}
        <div className="max-w-[42rem] text-[1.0625rem] leading-relaxed">
          <Prose text={stage.context} />
        </div>
        {before.components.size > 0 && (
          <details className="group sheet overflow-hidden">
            <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 transition-colors select-none hover:bg-hover sm:px-5 [&::-webkit-details-marker]:hidden">
              <span className="grid size-7 shrink-0 place-items-center rounded-[8px] bg-well text-ink-2 shadow-[var(--shadow-key)]" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 14 14">
                  <rect x="1" y="2" width="5" height="4" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2" />
                  <rect x="8" y="2" width="5" height="4" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2" />
                  <rect x="4.5" y="8.5" width="5" height="4" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2" />
                </svg>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[0.875rem] font-medium">The system so far</span>
                <span className="block text-[0.75rem] text-ink-3">
                  {before.components.size} parts in place before this stage
                </span>
              </span>
              <span className="text-[0.8125rem] font-medium text-ink-3 group-open:hidden">Show</span>
              <span className="hidden text-[0.8125rem] font-medium text-ink-3 group-open:inline">Hide</span>
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                aria-hidden="true"
                className="text-ink-3 transition-transform group-open:rotate-180"
              >
                <path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </summary>
            <div className="dotgrid border-t border-rule-soft px-3 py-5 sm:px-6">
              <SystemMap
                bare
                compact
                label={`${investigation.title}: system before stage ${index + 1}`}
                components={investigation.system.components}
                flows={investigation.system.flows}
                visibleComponents={[...before.components]}
                visibleFlows={[...before.flows]}
              />
            </div>
          </details>
        )}
      </section>

      {stage.lesson ? (
        <section aria-labelledby="learn" className="mt-16">
          <h2 id="learn" className="text-[1.375rem] leading-[1.2] font-semibold tracking-[-0.025em]">
            What you need to know
          </h2>
          <div className="mt-2">
            <Lesson lessonKey={`stage:${investigation.id}/${stage.id}`} steps={stage.lesson} finishLabel="the question">
              <YourTurn phase={PHASE_LABELS[stage.phase]}>{workspace}</YourTurn>
            </Lesson>
          </div>
        </section>
      ) : (
        <section aria-label="Your answer" className="mt-14">
          <YourTurn phase={PHASE_LABELS[stage.phase]}>{workspace}</YourTurn>
        </section>
      )}

      <nav
        aria-label="Stage navigation"
        className="mt-16 flex flex-col-reverse gap-3 border-t border-rule pt-6 sm:flex-row sm:items-center sm:justify-between"
      >
        {previous ? (
          <Link
            href={`/investigations/${investigation.id}/${previous.id}`}
            className="group flex min-w-0 items-center gap-3 rounded-[10px] py-2 pr-3 text-ink-2 transition-colors hover:text-ink"
          >
            <span aria-hidden="true" className="transition-transform group-hover:-translate-x-0.5">
              ←
            </span>
            <span className="min-w-0">
              <span className="block text-[0.75rem] text-ink-3">Previous</span>
              <span className="block truncate text-[0.875rem] font-medium">{previous.title}</span>
            </span>
          </Link>
        ) : (
          <Link
            href={`/investigations/${investigation.id}`}
            className="flex items-center gap-3 py-2 text-[0.875rem] text-ink-2 transition-colors hover:text-ink"
          >
            <span aria-hidden="true">←</span> Overview
          </Link>
        )}
        <Link
          href={`/investigations/${investigation.id}/${next ? next.id : "review"}`}
          className="group flex min-w-0 items-center justify-between gap-5 rounded-[12px] bg-[image:var(--ink-fill)] px-5 py-3 text-accent-ink shadow-[var(--shadow-ink)] transition-[background-image] hover:bg-[image:var(--ink-fill-hover)] sm:max-w-[26rem]"
        >
          <span className="min-w-0">
            <span className="block text-[0.75rem] opacity-70">{next ? `Next · stage ${index + 2}` : "Finished the stages"}</span>
            <span className="block truncate text-[0.9375rem] font-medium">
              {next ? next.title : "Read the full walkthrough"}
            </span>
          </span>
          <DotArrow />
        </Link>
      </nav>
    </article>
  );
}
