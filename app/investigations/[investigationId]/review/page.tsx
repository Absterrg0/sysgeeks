import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CompetencyBreakdown } from "@/components/investigation/competencies";
import { ShareResult } from "@/components/investigation/share-result";
import { StageWalkthrough } from "@/components/investigation/walkthrough";
import { Prose } from "@/components/prose";
import { SystemMap } from "@/components/system-map";
import { SourceList } from "@/components/writeup";
import { DashList, Section } from "@/components/page-header";
import { DotArrow } from "@/components/icons";
import { getInvestigation, listInvestigations, writeupsForInvestigation } from "@/lib/content";
import { breadcrumbs, clipDescription, faqPage, jsonLd, pageMetadata, systemNameForTitle } from "@/lib/metadata";
import { proseToPlainText } from "@/lib/prose";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export function generateStaticParams() {
  return listInvestigations().map((inv) => ({ investigationId: inv.id }));
}

export const dynamicParams = false;

function lowerFirst(text: string) {
  return /^[A-Z][a-z]/.test(text) ? text[0]!.toLowerCase() + text.slice(1) : text;
}

/** "How to design a URL Shortener": the walkthrough answers the question people type, the overview asks it. */
function howTo(searchTitle: string) {
  return `How to ${lowerFirst(searchTitle)}`;
}

export async function generateMetadata(
  props: PageProps<"/investigations/[investigationId]/review">,
): Promise<Metadata> {
  const { investigationId } = await props.params;
  const inv = getInvestigation(investigationId);
  if (!inv) return {};
  const fullTitle = `${howTo(inv.searchTitle)}: Step-by-Step System Design`;
  const systemName =
    inv.id === "shard-live-database"
      ? "Database Sharding"
      : systemNameForTitle(inv.searchTitle).replace(/ System$/, "");
  return pageMetadata({
    title:
      inv.id === "api-rate-limiter"
        ? "API Rate Limiter System Design Walkthrough"
        : inv.id === "url-shortener"
        ? "URL Shortener System Design: Full Walkthrough"
        : inv.id === "shard-live-database"
          ? "Postgres Sharding: Migration Walkthrough"
        : fullTitle.length <= 55
          ? fullTitle
          : `System Design Walkthrough: ${systemName}`,
    description: clipDescription(
      inv.id === "api-rate-limiter"
        ? "Design a distributed API rate limiter: choose a token bucket, share atomic counters across servers, return 429 and Retry-After, and plan for Redis failure."
        : inv.id === "shard-live-database"
          ? "A worked Postgres sharding example based on Notion: choose a workspace key, map logical shards to hosts, verify the copy, then cut over with a brief pause."
        : inv.answerSummary ??
            `${howTo(inv.searchTitle)}, step by step: ${inv.system.components.map((c) => c.label).join(", ")}. ${inv.premise}`,
    ),
    path: `/investigations/${inv.id}/review`,
  });
}

export default async function ReviewPage(props: PageProps<"/investigations/[investigationId]/review">) {
  const { investigationId } = await props.params;
  const inv = getInvestigation(investigationId);
  if (!inv) notFound();
  const { synthesis, system } = inv;
  const sources = writeupsForInvestigation(inv.id);
  const componentName = new Map(system.components.map((c) => [c.id, c.label]));
  const lastStage = inv.stages[inv.stages.length - 1];
  const firstStage = inv.stages[0];
  const shortAnswer =
    inv.answerSummary ??
    `${howTo(inv.searchTitle)}: ${system.components
      .map((c) => `${c.label} (${lowerFirst(c.responsibility).replace(/\.$/, "")})`)
      .join("; ")}.`;

  const toc = [
    { id: "answer", label: "The short answer" },
    { id: "architecture", label: "The architecture" },
    ...(sources.length > 0 ? [{ id: "sources", label: "Primary sources" }] : []),
    { id: "why", label: "Why it works" },
    { id: "invariants", label: "Invariants" },
    { id: "relies", label: "What it relies on" },
    { id: "tradeoffs", label: "Tradeoffs" },
    { id: "alternatives", label: "Alternatives" },
    { id: "breaks", label: "When it stops working" },
    { id: "walkthrough", label: "Every stage" },
    { id: "evidence", label: "How you did" },
    { id: "variants", label: "As an interview question" },
  ];

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
                { name: "Full walkthrough", path: `/investigations/${inv.id}/review` },
              ]),
              {
                "@type": "LearningResource",
                name: `${inv.searchTitle}: full system design walkthrough`,
                description: `Every stage of "${inv.title}", decided and explained: the question, the answer, the reasoning, the tradeoffs, and the finished architecture.`,
                url: `${SITE_URL}/investigations/${inv.id}/review`,
                learningResourceType: "Walkthrough",
                author: { "@id": `${SITE_URL}/#organization` },
                educationalLevel: inv.difficulty,
                teaches: inv.competencies.map((c) => c.label),
                isAccessibleForFree: true,
                inLanguage: "en",
                provider: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
                citation: sources.map((source) => ({
                  "@type": "CreativeWork",
                  name: source.title,
                  url: source.url,
                })),
              },
              faqPage([
                { question: `How do you ${lowerFirst(inv.searchTitle)}?`, answer: shortAnswer },
                ...inv.stages.map((stage) => ({
                  question: proseToPlainText(stage.interaction.prompt),
                  answer: proseToPlainText(stage.reveal.reasoning),
                })),
              ]),
            ],
          }),
        }}
      />
      <header className="pt-8 sm:pt-12">
        <p className="text-[0.8125rem] text-ink-3">
          <Link href={`/investigations/${inv.id}`} className="transition-colors hover:text-ink">
            {inv.title}
          </Link>
          <span className="mx-1.5 text-rule-strong">/</span>
          The finished design, decision by decision
        </p>
        <h1 className="mt-3 max-w-[24ch] text-[clamp(2rem,1.6rem+1.4vw,2.75rem)] leading-[1.05] font-semibold tracking-[-0.035em] text-balance">
          {howTo(inv.searchTitle)}
        </h1>
        <p className="mt-4 max-w-[40rem] text-[1.0625rem] leading-relaxed text-ink-2 text-pretty">
          Not the one correct diagram, but a design you can defend under these constraints: the finished architecture,
          then every stage&apos;s question with the reasoning that answers it, the tradeoffs it accepts, and where another
          engineer could land differently.
        </p>
        <p className="mt-3 text-[0.8125rem] text-ink-3">
          By SysGeeks · {inv.stages.length} stages · {system.components.length} parts
        </p>
        <nav aria-label="Practice this system design question" className="mt-7 flex flex-wrap gap-2.5">
          {firstStage && (
            <Link href={`/investigations/${inv.id}/${firstStage.id}`} className="btn btn-accent btn-lg group">
              Try it before reading the answer
              <DotArrow />
            </Link>
          )}
          <Link href={`/investigations/${inv.id}/design`} className="btn btn-secondary btn-lg">
            Design it from a blank page
          </Link>
        </nav>
      </header>

      <div className="mt-12 grid gap-x-16 lg:grid-cols-[minmax(0,1fr)_13rem]">
      <div className="min-w-0 max-w-[46rem]">
        <section aria-labelledby="short-answer" id="answer" className="scroll-mt-36">
          <h2 id="short-answer" className="text-[1.375rem] leading-[1.2] font-semibold tracking-[-0.025em]">
            The short answer
          </h2>
          <p className="mt-3 text-[1.0625rem] leading-relaxed">
            {inv.answerSummary ??
              `${system.components.length} parts, each with one job. The map below shows how requests and data move between them; the stages after it explain why each part is there.`}
          </p>
          <dl className="sheet mt-6 overflow-hidden">
            {system.components.map((c) => (
              <div key={c.id} className="sheet-row grid gap-x-6 gap-y-0.5 px-5 py-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
                <dt className="text-[0.875rem] font-medium">{c.label}</dt>
                <dd className="text-[0.875rem] leading-relaxed text-ink-2">{c.responsibility}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="architecture-title" id="architecture" className="mt-14 scroll-mt-36">
          <h2 id="architecture-title" className="text-[1.375rem] leading-[1.2] font-semibold tracking-[-0.025em]">
            The architecture
          </h2>
          <div className="mt-5">
            <SystemMap label={`${inv.title}: final architecture`} components={system.components} flows={system.flows} />
          </div>
        </section>

        {sources.length > 0 && (
          <Section
            id="sources"
            title="Primary sources behind this design"
            description="Published engineering accounts inform the assumptions and trade-offs in this worked example. The design here is an interview practice proposal, not a claim about any company’s private architecture."
          >
            <SourceList writeups={sources} showCompany />
          </Section>
        )}

        <Section id="why" title="Why does this design work?">
          <div className="max-w-[66ch]">
            <Prose text={synthesis.whyItWorks} />
          </div>
        </Section>

        <Section id="invariants" title="Invariants, and where they are enforced">
          <ul className="max-w-[66ch] space-y-5">
            {system.invariants.map((inv2) => (
              <li key={inv2.id}>
                <p className="text-[0.9375rem] font-medium leading-snug">{inv2.statement}</p>
                <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-2">
                  {inv2.mechanism}{" "}
                  <span className="text-ink-3">
                    Enforced by {inv2.enforcedBy.map((id) => componentName.get(id) ?? id).join(", ")}.
                  </span>
                </p>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="relies" title="What does it rely on?">
          <DashList items={synthesis.reliesOn} />
        </Section>

        <Section id="tradeoffs" title="What tradeoffs does it make?">
          <div className="panel overflow-x-auto px-5 py-1">
            <table className="data-table min-w-[560px]">
              <thead>
                <tr>
                  <th scope="col" className="w-[30%]">
                    Choice
                  </th>
                  <th scope="col">Gains</th>
                  <th scope="col">Costs</th>
                </tr>
              </thead>
              <tbody>
                {synthesis.tradeoffs.map((t) => (
                  <tr key={t.choice}>
                    <th scope="row">{t.choice}</th>
                    <td>{t.gains}</td>
                    <td>{t.costs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section id="alternatives" title="What are the reasonable alternatives?">
          <dl className="max-w-[66ch] space-y-4">
            {synthesis.alternatives.map((a) => (
              <div key={a.design}>
                <dt className="text-[0.9375rem] font-medium">{a.design}</dt>
                <dd className="mt-0.5 text-[0.875rem] leading-relaxed text-ink-2">Better when {lowerFirst(a.preferWhen)}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section id="breaks" title="When does it stop working?">
          <DashList items={synthesis.breaksWhen} />
        </Section>

        <Section
          id="walkthrough"
          title="Every stage, decided and explained"
          description="Spoilers, for the whole investigation: each stage's question and its answer, the reasoning behind it, and the tradeoffs it accepts. If you have not worked through the stages yet, you may want to do that first."
          action={
            firstStage && (
              <Link href={`/investigations/${inv.id}/${firstStage.id}`} className="btn btn-secondary">
                Work through the stages
              </Link>
            )
          }
        >
          <nav aria-label="Stages in this walkthrough" className="sheet px-4 py-4 sm:px-5 lg:hidden">
            <p className="kicker mb-2.5">Jump to a stage</p>
            <ol className="grid gap-x-8 gap-y-1.5 text-[0.875rem] sm:grid-cols-2">
              {inv.stages.map((stage, i) => (
                <li key={stage.id}>
                  <a href={`#stage-${stage.id}`} className="flex gap-2.5 text-ink-2 hover:text-ink">
                    <span className="font-mono text-[0.75rem] leading-5 text-ink-3 tabular-nums">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0">{stage.title}</span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="mt-10 space-y-10">
            {inv.stages.map((stage, i) => (
              <StageWalkthrough
                key={stage.id}
                investigationId={inv.id}
                stage={stage}
                index={i}
                total={inv.stages.length}
              />
            ))}
          </div>
        </Section>

        <Section id="evidence" title="How you did">
          <CompetencyBreakdown
            investigationId={inv.id}
            competencies={inv.competencies}
            stageCount={inv.stages.length}
            firstStageId={inv.stages[0]?.id ?? ""}
          />
          <ShareResult
            investigationId={inv.id}
            searchTitle={inv.searchTitle}
            stageCount={inv.stages.length}
            url={`${SITE_URL}/investigations/${inv.id}`}
          />
        </Section>

        <Section id="variants" title="Now try it as an interview question">
          <DashList items={inv.interviewVariants.map((v) => `“${v}”`)} muted />
          <p className="mt-4 text-[0.8125rem] text-ink-2">
            The{" "}
            <Link href="/review#session" className="link">
              timed session
            </Link>{" "}
            in Review mixes stages from this and other systems with concept recall and questions about your own projects.
          </p>
          <p className="mt-3 text-[0.8125rem] text-ink-2">
            For concise outlines of the prompts, see the{" "}
            <Link href="/investigations" className="link">
              system design interview questions and answers
            </Link>
            .
          </p>
          {lastStage && (
            <Link href={`/investigations/${inv.id}/${lastStage.id}`} className="btn btn-secondary mt-5">
              Back to the last stage
            </Link>
          )}
        </Section>
      </div>
      <aside aria-label="On this page" className="hidden lg:block">
        <nav className="sticky top-36 max-h-[calc(100dvh-10rem)] overflow-y-auto pb-6 text-[0.8125rem]">
          <p className="kicker mb-3">On this page</p>
          <ol className="space-y-2 border-l border-rule">
            {toc.map((item) => (
              <li key={item.id}>
                <a href={`#${item.id}`} className="-ml-px block border-l border-transparent pl-3 text-ink-2 transition-colors hover:border-ink hover:text-ink">
                  {item.label}
                </a>
                {item.id === "walkthrough" && (
                  <ol className="mt-2 space-y-1.5">
                    {inv.stages.map((stage, i) => (
                      <li key={stage.id}>
                        <a
                          href={`#stage-${stage.id}`}
                          className="-ml-px flex gap-2 border-l border-transparent pl-5 text-ink-3 transition-colors hover:border-ink hover:text-ink"
                        >
                          <span className="font-mono text-[0.6875rem] leading-5 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                          <span className="min-w-0 leading-5">{stage.title}</span>
                        </a>
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            ))}
          </ol>
        </nav>
      </aside>
      </div>
    </div>
  );
}
