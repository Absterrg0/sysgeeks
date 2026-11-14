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
import { DashList, Section } from "@/components/page-header";
import { DotArrow } from "@/components/icons";
import { resolveExercise } from "@/lib/content/exercises";
import { conceptsReferencing, getConcept, getInvestigation, listConcepts, stagesUsingConcept, writeupsForConcept } from "@/lib/content";
import { DOMAIN_LABELS } from "@/lib/domain/content";
import { conceptQuestions } from "@/lib/concept-questions";
import { breadcrumbs, clipDescription, jsonLd, pageMetadata } from "@/lib/metadata";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export function generateStaticParams() {
  return listConcepts().map((c) => ({ conceptId: c.id }));
}

export const dynamicParams = false;

export async function generateMetadata(props: PageProps<"/concepts/[conceptId]">): Promise<Metadata> {
  const { conceptId } = await props.params;
  const c = getConcept(conceptId);
  if (!c) return {};
  if (c.id === "rate-limiting") {
    return pageMetadata({
      title: "How to Design a Rate Limiter in System Design",
      description:
        "Design a rate limiter for a distributed API: choose token bucket vs windows, share per-key state across servers, and handle Redis failure and HTTP 429 retries.",
      path: `/concepts/${c.id}`,
      imagePath: `/concepts/${c.id}/opengraph-image`,
    });
  }
  if (c.id === "webhooks") {
    return pageMetadata({
      title: "Webhooks in System Design: Delivery and Recovery",
      description:
        "Handle webhook retries, duplicates, and out-of-order events with signature checks, idempotency, fast acknowledgements, and reconciliation.",
      path: `/concepts/${c.id}`,
      imagePath: `/concepts/${c.id}/opengraph-image`,
    });
  }
  return pageMetadata({
    title: `${c.title} in System Design`,
    description: clipDescription(c.summary),
    path: `/concepts/${c.id}`,
    imagePath: `/concepts/${c.id}/opengraph-image`,
  });
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

  const rateLimiterExercise = concept.id === "rate-limiting" ? getInvestigation("api-rate-limiter") : undefined;
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
    <div>
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
            ],
          }),
        }}
      />
      <header className="pt-10 sm:pt-14">
        <nav aria-label="Breadcrumb" className="text-[0.8125rem] text-ink-3">
          <Link href="/concepts" className="transition-colors hover:text-ink">
            Concepts
          </Link>
          <span className="mx-2 text-rule-strong">/</span>
          {DOMAIN_LABELS[concept.domain]}
        </nav>
        <h1 className="mt-4 max-w-[22ch] text-[clamp(2rem,1.6rem+1.4vw,2.75rem)] leading-[1.05] font-semibold tracking-[-0.035em] text-balance">
          {concept.id === "rate-limiting"
            ? "How to design a rate limiter"
            : concept.id === "webhooks"
              ? "Webhooks: delivery, retries, and recovery"
              : concept.title}
        </h1>
        <p className="mt-4 max-w-[58ch] text-[1rem] leading-relaxed text-ink-2 text-pretty">{concept.summary}</p>
        <div className="mt-7 flex flex-wrap items-center gap-2.5">
          {concept.lesson ? (
            <a href="#learn" className="btn btn-accent group">
              Start the lesson
              <DotArrow />
            </a>
          ) : (
            claims && (
              <a href="#check" className="btn btn-accent group">
                Check yourself
                <DotArrow />
              </a>
            )
          )}
          {explain && (
            <a href="#explain" className="btn btn-secondary">
              Explain it in your own words
            </a>
          )}
        </div>
        <p className="mt-6 text-[0.75rem] text-ink-3">By SysGeeks</p>
      </header>

      {rateLimiterExercise && (
        <section
          aria-labelledby="distributed-rate-limiter-design"
          className="sheet mt-10 max-w-[46rem] p-6 sm:p-7"
        >
          <h2 id="distributed-rate-limiter-design" className="text-[1.375rem] leading-[1.2] font-semibold tracking-[-0.025em]">
            How to design a rate limiter for a distributed API
          </h2>
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-2">
            Use a token bucket per API key, with the customer&apos;s refill rate and burst capacity. Update it atomically in
            shared state so requests reaching different API servers consume one allowance. When the bucket is empty, return
            HTTP 429 with <code>Retry-After</code>. Set a short timeout for the limiter store and decide how to degrade if it
            fails; a local approximate limit can preserve API availability while shared state recovers.
          </p>
          <p className="mt-3 text-[0.875rem] leading-relaxed text-ink-2">
            That design assumes requests can be attributed to a key and that clients respect the retry response. Expensive
            endpoints may also need cost-based limits, and a shared store adds latency and a failure mode to every request.
          </p>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
            <Link href={`/investigations/${rateLimiterExercise.id}`} className="link text-[0.875rem]">
              Try the API rate limiter interview exercise
            </Link>
            <Link href={`/investigations/${rateLimiterExercise.id}/review`} className="link text-[0.875rem]">
              Read the full worked rate limiter design
            </Link>
          </div>
        </section>
      )}

      <div className="mt-4 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-x-14">
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
                    spec={{ ref: claims.summary.ref, interaction: claims.interaction, tags: claims.tags, title: claims.summary.title }}
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
                spec={{ ref: explain.summary.ref, interaction: explain.interaction, tags: explain.tags, title: explain.summary.title }}
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
          <div className="mt-14 flex items-center justify-between gap-4 border-t border-rule pt-5">
            <p className="text-[0.8125rem] text-ink-3">Useful? Send it to someone preparing.</p>
            <ShareButton
              url={`${SITE_URL}/concepts/${concept.id}`}
              title={`${concept.title} in System Design · ${SITE_NAME}`}
              text={`${concept.title}, explained for system design interviews.`}
            />
          </div>
        </div>

        <aside className="mt-10 space-y-4 self-start lg:sticky lg:top-24 lg:mt-12">
          <section aria-labelledby="standing" className="sheet p-5">
            <h2 id="standing" className="kicker mb-3">
              Your standing
            </h2>
            <ConceptStanding conceptId={concept.id} showEmpty />
          </section>

          {byInvestigation.size > 0 && (
            <section aria-labelledby="used-in" className="sheet overflow-hidden">
              <h2 id="used-in" className="flex items-baseline justify-between px-5 pt-4 pb-2 text-[0.9375rem] font-semibold tracking-[-0.015em]">
                Where you practise it
                <span className="font-mono text-[0.75rem] font-normal text-ink-3">{byInvestigation.size}</span>
              </h2>
              <ul className="max-h-[min(32rem,60dvh)] overflow-y-auto pb-2">
                {[...byInvestigation].map(([id, entry]) => (
                  <li key={id} className="border-t border-rule-soft px-5 py-3">
                    <Link
                      href={`/investigations/${id}`}
                      className="text-[0.875rem] font-medium tracking-[-0.01em] hover:underline hover:decoration-rule-strong hover:underline-offset-4"
                    >
                      {entry.title}
                    </Link>
                    <ul className="mt-1 space-y-0.5">
                      {entry.stages.map(({ stage }) => (
                        <li key={stage.id}>
                          <Link
                            href={`/investigations/${id}/${stage.id}`}
                            className="block truncate text-[0.8125rem] text-ink-3 transition-colors hover:text-ink"
                          >
                            {stage.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
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
