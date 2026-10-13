import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConceptStanding } from "@/components/concept-standing";
import { buildSlots } from "@/components/exercise/slots";
import { ExerciseWorkspace } from "@/components/exercise/workspace";
import { Lesson } from "@/components/lesson/lesson";
import { Prose } from "@/components/prose";
import { ShareButton } from "@/components/share";
import { SourceList } from "@/components/writeup";
import { DashList, PageHeader, Section } from "@/components/page-header";
import { resolveExercise } from "@/lib/content/exercises";
import { conceptsReferencing, getConcept, listConcepts, stagesUsingConcept, writeupsForConcept } from "@/lib/content";
import { DOMAIN_LABELS } from "@/lib/domain/content";
import { conceptQuestions } from "@/lib/concept-questions";
import { breadcrumbs, clip, faqPage, jsonLd, pageMetadata } from "@/lib/metadata";
import { proseToPlainText } from "@/lib/prose";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export function generateStaticParams() {
  return listConcepts().map((c) => ({ conceptId: c.id }));
}

export const dynamicParams = false;

export async function generateMetadata(props: PageProps<"/concepts/[conceptId]">): Promise<Metadata> {
  const { conceptId } = await props.params;
  const c = getConcept(conceptId);
  if (!c) return {};
  return pageMetadata({ title: `${c.title} in System Design`, description: clip(c.summary), path: `/concepts/${c.id}` });
}

function Terms({ items }: { items: { title: string; body: string }[] }) {
  return (
    <dl className="max-w-[66ch] space-y-4">
      {items.map((item) => (
        <div key={item.title}>
          <dt className="text-[0.9375rem] font-medium">{item.title}</dt>
          <dd className="mt-0.5 text-[0.9375rem] leading-relaxed text-ink-2">{item.body}</dd>
        </div>
      ))}
    </dl>
  );
}

export default async function ConceptPage(props: PageProps<"/concepts/[conceptId]">) {
  const { conceptId } = await props.params;
  const concept = getConcept(conceptId);
  if (!concept) notFound();

  const uses = stagesUsingConcept(concept.id);
  const sources = writeupsForConcept(concept.id);
  const related = [
    ...concept.relatedConceptIds,
    ...conceptsReferencing(concept.id)
      .map((c) => c.id)
      .filter((id) => !concept.relatedConceptIds.includes(id)),
  ].flatMap((id) => {
    const c = getConcept(id);
    return c ? [c] : [];
  });
  const claims = resolveExercise({
    kind: "concept-claims",
    conceptId: concept.id,
  });
  const explain = resolveExercise({
    kind: "concept-explain",
    conceptId: concept.id,
  });
  const questions = conceptQuestions(concept.title);
  const byInvestigation = new Map<string, { title: string; stages: typeof uses }>();
  for (const use of uses) {
    const entry = byInvestigation.get(use.investigation.id) ?? {
      title: use.investigation.title,
      stages: [],
    };
    entry.stages.push(use);
    byInvestigation.set(use.investigation.id, entry);
  }

  return (
    <div className="measure lg:max-w-[64rem]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@graph": [
              breadcrumbs([
                { name: "System design concepts", path: "/concepts" },
                { name: concept.title, path: `/concepts/${concept.id}` },
              ]),
              {
                "@type": "DefinedTerm",
                "@id": `${SITE_URL}/concepts/${concept.id}#term`,
                name: concept.title,
                description: concept.summary,
                url: `${SITE_URL}/concepts/${concept.id}`,
                inDefinedTermSet: {
                  "@type": "DefinedTermSet",
                  name: `${SITE_NAME} system design concepts`,
                  url: `${SITE_URL}/concepts`,
                },
              },
              {
                "@type": "WebPage",
                "@id": `${SITE_URL}/concepts/${concept.id}#webpage`,
                url: `${SITE_URL}/concepts/${concept.id}`,
                name: concept.title,
                author: { "@id": `${SITE_URL}/#organization` },
                mainEntity: { "@id": `${SITE_URL}/concepts/${concept.id}#term` },
              },
              faqPage([
                { question: questions.problem, answer: proseToPlainText(concept.problem) },
                { question: questions.mechanism, answer: proseToPlainText(concept.mechanism) },
                { question: questions.assumptions, answer: concept.assumptions.join(" ") },
                {
                  question: questions.failures,
                  answer: concept.failureModes.map((f) => `${f.name}: ${f.description}`).join(" "),
                },
                {
                  question: questions.alternatives,
                  answer: concept.alternatives.map((a) => `${a.name}: ${a.when}`).join(" "),
                },
              ]),
            ],
          }),
        }}
      />
      <PageHeader
        title={concept.title}
        meta="By SysGeeks"
        eyebrow={
          <>
            <Link href="/concepts" className="hover:text-ink">
              Concepts
            </Link>
            <span className="mx-1.5 text-rule-strong">/</span>
            {DOMAIN_LABELS[concept.domain]}
          </>
        }
        actions={
          <>
            {concept.lesson ? (
              <a href="#learn" className="btn btn-secondary">
                Start the lesson
              </a>
            ) : (
              claims && (
                <a href="#check" className="btn btn-secondary">
                  Check yourself
                </a>
              )
            )}
            {explain && (
              <a href="#explain" className="btn btn-ghost">
                Explain it in your own words
              </a>
            )}
            <ShareButton
              url={`${SITE_URL}/concepts/${concept.id}`}
              title={`${concept.title} in System Design · ${SITE_NAME}`}
              text={`${concept.title}, explained for system design interviews.`}
            />
          </>
        }
      >
        {concept.summary}
      </PageHeader>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-x-12">
        <div className="min-w-0">
          {concept.lesson ? (
            <>
              <Section id="learn" title="Learn it">
                <Lesson lessonKey={`concept:${concept.id}`} steps={concept.lesson} />
              </Section>
              <Section id="reference" title="Quick reference" description="The same ideas, condensed for revision.">
                <div className="grid gap-x-12 gap-y-10 sm:grid-cols-2">
                  <div>
                    <h3 className="mb-3 text-[0.875rem] font-medium text-ink-2">How it goes wrong</h3>
                    <Terms items={concept.failureModes.map((f) => ({ title: f.name, body: f.description }))} />
                  </div>
                  <div>
                    <h3 className="mb-3 text-[0.875rem] font-medium text-ink-2">Instead, consider</h3>
                    <Terms items={concept.alternatives.map((a) => ({ title: a.name, body: a.when }))} />
                  </div>
                  <div>
                    <h3 className="mb-3 text-[0.875rem] font-medium text-ink-2">In practice</h3>
                    <Terms items={concept.implementations.map((impl) => ({ title: impl.name, body: impl.note }))} />
                  </div>
                  <div>
                    <h3 className="mb-3 text-[0.875rem] font-medium text-ink-2">It assumes</h3>
                    <DashList items={concept.assumptions} />
                  </div>
                </div>
              </Section>
            </>
          ) : (
            <>
              <Section id="problem" title={questions.problem}>
                <div className="max-w-[66ch]">
                  <Prose text={concept.problem} />
                </div>
              </Section>
              <Section id="mechanism" title={questions.mechanism}>
                <div className="max-w-[66ch]">
                  <Prose text={concept.mechanism} />
                </div>
              </Section>
              <Section id="assumptions" title={questions.assumptions}>
                <DashList items={concept.assumptions} />
              </Section>
              <Section id="failures" title={questions.failures}>
                <Terms items={concept.failureModes.map((f) => ({ title: f.name, body: f.description }))} />
              </Section>
              <Section id="alternatives" title={questions.alternatives}>
                <Terms items={concept.alternatives.map((a) => ({ title: a.name, body: a.when }))} />
              </Section>
              <Section id="implementations" title="In practice" description="From simplest to most specialised.">
                <Terms items={concept.implementations.map((impl) => ({ title: impl.name, body: impl.note }))} />
              </Section>

              {claims && (
                <Section id="check" title="Check yourself">
                  <ExerciseWorkspace
                    spec={{ ref: claims.summary.ref, interaction: claims.interaction, tags: claims.tags }}
                    slots={buildSlots(claims.interaction)}
                    context="practice"
                  />
                </Section>
              )}
            </>
          )}
          {explain && (
            <Section id="explain" title="Explain it in your own words">
              <ExerciseWorkspace
                spec={{ ref: explain.summary.ref, interaction: explain.interaction, tags: explain.tags }}
                slots={buildSlots(explain.interaction)}
                context="practice"
              />
            </Section>
          )}

          {sources.length > 0 && (
            <Section id="further-reading" title="Further reading" description="Engineers describing it in systems they run.">
              <SourceList writeups={sources} showCompany />
            </Section>
          )}

          {related.length > 0 && (
            <Section id="related" title="Related concepts">
              <ul className="grid max-w-[66ch] gap-x-8 gap-y-3 sm:grid-cols-2">
                {related.map((c) => (
                  <li key={c.id}>
                    <Link href={`/concepts/${c.id}`} className="link text-[0.9375rem]">
                      {c.title}
                    </Link>
                    <p className="mt-0.5 text-[0.8125rem] leading-snug text-ink-2">{c.summary}</p>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>

        <aside className="well-sm mt-4 self-start p-5 lg:mt-12">
          <section aria-labelledby="standing">
            <h2 id="standing" className="kicker mb-3">
              Your standing
            </h2>
            <ConceptStanding conceptId={concept.id} showEmpty />
          </section>

          {byInvestigation.size > 0 && (
            <section aria-labelledby="used-in" className="mt-6 border-t border-rule-soft pt-5">
              <h2 id="used-in" className="kicker mb-3">
                Where you practise it
              </h2>
              <ul className="space-y-4">
                {[...byInvestigation].map(([id, entry]) => (
                  <li key={id}>
                    <Link href={`/investigations/${id}`} className="link text-[0.9375rem]">
                      {entry.title}
                    </Link>
                    <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-2">
                      {entry.stages.map(({ stage }, i) => (
                        <span key={stage.id}>
                          {i > 0 && " · "}
                          <Link href={`/investigations/${id}/${stage.id}`} className="link">
                            {stage.title}
                          </Link>
                        </span>
                      ))}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
