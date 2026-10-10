import type { Metadata } from "next";
import { InterviewSetup } from "@/components/interview/interview-setup";
import type { ReactNode } from "react";
import { Section } from "@/components/page-header";
import { ReviewTabs } from "@/components/review/review-tabs";
import type { ReviewSystem } from "@/components/review/review-overview";
import { ClaimDrill, type DrillConcept } from "@/components/practice/claim-drill";
import { DimensionPractice, type PracticeExercise } from "@/components/practice/dimension-practice";
import { Prose } from "@/components/prose";
import { DataControls } from "@/components/understanding/data-controls";
import { UnderstandingView, type InvestigationOutline } from "@/components/understanding/understanding-view";
import { listConcepts, listInvestigations } from "@/lib/content";
import { listExercises } from "@/lib/content/exercises";
import type { InterviewCandidate } from "@/lib/domain/interview";
import type { CuratedLabels } from "@/lib/exercise-labels";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Review: System Design Practice and Mock Interviews",
  description:
    "Come back to what you learned: answers due for review, timed mock interview sessions across every system, claim checks and drills by dimension.",
  path: "/review",
});


/**
 * Everything that is not one system: coming back to what you answered, mixed timed sessions across all of
 * them, and short drills. Systems are where you learn; this is where it sticks.
 */
export default function ReviewPage() {
  const exercises = listExercises();
  const concepts = listConcepts();
  const investigations: InvestigationOutline[] = listInvestigations().map((inv) => ({
    id: inv.id,
    title: inv.title,
    stageCount: inv.stages.length,
    firstStageId: inv.stages[0]?.id ?? "",
    competencies: inv.competencies,
  }));
  const conceptTitles = Object.fromEntries(concepts.map((c) => [c.id, c.title]));
  const curated: CuratedLabels = Object.fromEntries(
    exercises.map((e) => [e.key, { title: e.title, source: e.source, href: e.href }]),
  );
  const candidates: InterviewCandidate[] = exercises.map((e) => ({
    key: e.key,
    ref: e.ref,
    interactionKind: e.interactionKind,
    phase: e.phase,
    eventKind: e.eventKind,
    dimensions: e.dimensions,
    conceptIds: e.conceptIds,
    minutes: e.minutes,
  }));
  const drillConcepts: DrillConcept[] = concepts.map((c) => ({ id: c.id, title: c.title, claims: c.claims }));
  const explanations = Object.fromEntries(
    concepts.flatMap((c) =>
      c.claims.map((claim) => [
        `${c.id}/${claim.id}`,
        <Prose key={claim.id} text={claim.explanation} className="prose-sm" />,
      ]),
    ),
  );
  const practice: PracticeExercise[] = exercises
    .filter((e) => e.ref.kind === "stage" || e.ref.kind === "concept-explain")
    .map((e) => ({ key: e.key, ref: e.ref, title: e.title, source: e.source, href: e.href, dimensions: e.dimensions }));

  const systems: ReviewSystem[] = listInvestigations().map((inv) => ({
    id: inv.id,
    title: inv.title,
    stages: inv.stages.map((st) => ({ id: st.id, title: st.title })),
  }));

  return (
    <ReviewTabs
      systems={systems}
      conceptCount={concepts.length}
      exerciseCount={exercises.length}
      curated={curated}
      panels={{
        standing: (
          <div className="space-y-2">
            <UnderstandingView investigations={investigations} concepts={conceptTitles} curated={curated} />
            <div className="grid gap-x-14 border-t border-rule pt-2 lg:grid-cols-2">
              <Section id="method" title="How evidence works">
                <div className="max-w-[66ch] space-y-3 text-[0.875rem] leading-relaxed text-ink-2">
                  <p>
                    <strong className="font-medium text-ink">Checked</strong> evidence comes from comparing your answer
                    with an authored key: which option you chose and how it is assessed, your verdicts on claims, your
                    sequence, the lines you flagged.
                  </p>
                  <p>
                    <strong className="font-medium text-ink">Self-assessed</strong> evidence comes from your written
                    reasoning. After seeing the reference, you mark which specific points your answer covered. Nothing
                    grades your writing automatically, so it is only as honest as your marks.
                  </p>
                  <p>
                    Every exercise trains some of six dimensions (trace, explain, defend, change, break, implement)
                    and touches named concepts. An exercise&apos;s signal is its weakest part.
                  </p>
                </div>
              </Section>
              <Section id="data" title="Your data">
                <DataControls />
              </Section>
            </div>
          </div>
        ),
        session: (
          <PanelIntro
            title="Mock interview"
            body="Explain a mechanism, make a design call, reason through a failure, and defend a system, ideally one you built. Drawn from what you have studied, with an honest debrief. For a full round on one system, open it and choose Interview."
          >
            <InterviewSetup candidates={candidates} />
          </PanelIntro>
        ),
        claims: (
          <PanelIntro
            title="Claim check"
            body="Statements engineers say in design reviews. Does each hold, fail, or depend on something?"
          >
            <ClaimDrill concepts={drillConcepts} explanations={explanations} />
          </PanelIntro>
        ),
        dimension: (
          <PanelIntro title="Drill a skill" body="Every exercise that trains one skill, weakest evidence first.">
            <DimensionPractice exercises={practice} />
          </PanelIntro>
        ),
      }}
    />
  );
}

/** A tool's own tab: one line saying what it is, then the tool. */
function PanelIntro({ title, body, children }: { title: string; body: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="text-[1rem] font-semibold">{title}</h2>
      <p className="mt-1 max-w-[72ch] text-[0.875rem] leading-relaxed text-ink-3">{body}</p>
      <div className="mt-5">{children}</div>
    </div>
  );
}
