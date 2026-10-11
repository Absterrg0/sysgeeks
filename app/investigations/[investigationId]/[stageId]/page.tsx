import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buildSlots, Reveal } from "@/components/exercise/slots";
import { ExerciseWorkspace } from "@/components/exercise/workspace";
import { EventBanner } from "@/components/investigation/event-banner";
import { Lesson } from "@/components/lesson/lesson";
import { SystemMap } from "@/components/system-map";
import { Prose } from "@/components/prose";
import { getConcept, getStage, listInvestigations } from "@/lib/content";
import { PHASE_LABELS } from "@/lib/domain/content";
import { type ExerciseRef } from "@/lib/domain/learner";
import { visibleAfter } from "@/lib/domain/visibility";
import { breadcrumbs, clip, jsonLd, pageMetadata, systemNameForTitle } from "@/lib/metadata";
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
    description: clip(
      stage.event
        ? `${proseToPlainText(stage.event.title)}. ${question} ${proseToPlainText(stage.event.detail)}`
        : `${question} ${proseToPlainText(stage.context)}`,
    ),
    path: `/investigations/${investigation.id}/${stage.id}`,
  });
}

export default async function StagePage(props: PageProps<"/investigations/[investigationId]/[stageId]">) {
  const { investigationId, stageId } = await props.params;
  const found = getStage(investigationId, stageId);
  if (!found) notFound();
  const { investigation, stage, index } = found;
  const ref: ExerciseRef = { kind: "stage", investigationId: investigation.id, stageId: stage.id };

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
          <h3 className="mb-3 text-[0.9375rem] font-medium">The system now</h3>
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
          <h3 className="mb-3 text-[0.9375rem] font-medium">Concepts in this stage</h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {concepts.map((c) => (
              <li key={c.id}>
                <Link href={`/concepts/${c.id}`} className="tile group block h-full px-4 py-3">
                  <span className="block text-[0.875rem] font-medium group-hover:text-accent">{c.title}</span>
                  <span className="mt-0.5 block text-[0.8125rem] leading-relaxed text-ink-2">{c.summary}</span>
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
      }}
      slots={buildSlots(stage.interaction)}
      reveal={reveal}
      context="investigation"
    />
  );

  return (
    <article className="measure">
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
      <header className="section rise pb-0 sm:pb-0">
        <p className="kicker">
          Stage {index + 1} of {investigation.stages.length} · {PHASE_LABELS[stage.phase]}
        </p>
        <h1 className="mt-3 font-display text-h1 text-balance">{stage.title}</h1>
      </header>

      <section aria-label="The situation" className="section space-y-6">
        {stage.event && <EventBanner event={stage.event} />}
        <div className="max-w-[66ch]">
          <Prose text={stage.context} />
        </div>
        {before.components.size > 0 && (
          <details className="group">
            <summary className="btn btn-secondary btn-sm w-fit select-none list-none text-ink-2 [&::-webkit-details-marker]:hidden">
              <svg
                width="10"
                height="10"
                viewBox="0 0 10 10"
                aria-hidden="true"
                className="transition-transform group-open:rotate-90"
              >
                <path d="M3.5 2l3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              <span className="font-medium">System so far</span>
              <span className="text-ink-3">· {before.components.size} parts</span>
            </summary>
            <div className="mt-3">
              <SystemMap
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
        <section aria-labelledby="learn" className="section">
          <h2 id="learn" className="mb-2 font-display text-[1.75rem] leading-tight">
            What you need to know
          </h2>
          <Lesson lessonKey={`stage:${investigation.id}/${stage.id}`} steps={stage.lesson} finishLabel="the question">
            <h2 className="mb-5 font-display text-[1.75rem] leading-tight">Your turn</h2>
            {workspace}
          </Lesson>
        </section>
      ) : (
        <section aria-label="Your answer" className="section">
          {workspace}
        </section>
      )}

      <nav aria-label="Stage navigation" className="mt-6 grid grid-cols-2 gap-3 py-8">
        {previous ? (
          <Link href={`/investigations/${investigation.id}/${previous.id}`} className="tile group min-w-0 p-4">
            <span className="kicker">Previous stage</span>
            <span className="mt-2 block text-h4 font-medium transition-colors group-hover:text-accent">
              {previous.title}
            </span>
          </Link>
        ) : (
          <span />
        )}
        <Link
          href={`/investigations/${investigation.id}/${next ? next.id : "review"}`}
          className="tile group min-w-0 p-4 text-right"
        >
          <span className="kicker">{next ? "Next stage" : "Finished the stages"}</span>
          <span className="mt-2 block text-h4 font-medium transition-colors group-hover:text-accent">
            {next ? next.title : "Read the full walkthrough"}
          </span>
        </Link>
      </nav>
    </article>
  );
}
