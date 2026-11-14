import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DesignRoundRunner, type ReferenceView } from "@/components/design/design-round";
import { DashList, PageHeader } from "@/components/page-header";
import { Prose } from "@/components/prose";
import { InlineText } from "@/components/prose-core";
import { SystemMap } from "@/components/system-map";
import { getConcept, getInvestigation, listInvestigations } from "@/lib/content";
import { designReference, interviewPrompt } from "@/lib/content/design-reference";
import { DESIGN_ROUND_MINUTES, DESIGN_SECTION_IDS } from "@/lib/domain/design-round";
import { breadcrumbs, clipDescription, jsonLd, pageMetadata, systemNameForTitle } from "@/lib/metadata";

export function generateStaticParams() {
  return listInvestigations().map((inv) => ({ investigationId: inv.id }));
}

export const dynamicParams = false;

export async function generateMetadata(
  props: PageProps<"/investigations/[investigationId]/design">,
): Promise<Metadata> {
  const { investigationId } = await props.params;
  const inv = getInvestigation(investigationId);
  if (!inv) return {};
  const fullTitle = `${inv.searchTitle}: Practice Round from a Blank Page`;
  const systemName =
    inv.id === "shard-live-database"
      ? "Database Sharding"
      : systemNameForTitle(inv.searchTitle).replace(/ System$/, "");
  return pageMetadata({
    title: fullTitle.length <= 55 ? fullTitle : `Blank-Page System Design: ${systemName}`,
    description: clipDescription(
      `A ${DESIGN_ROUND_MINUTES}-minute system design round: ${inv.premise} Write requirements, estimates, the design, deep dives and failure handling yourself, then compare with a reference design.`,
    ),
    path: `/investigations/${inv.id}/design`,
  });
}

const resolve = (id: string) => getConcept(id);

export default async function DesignPage(props: PageProps<"/investigations/[investigationId]/design">) {
  const { investigationId } = await props.params;
  const inv = getInvestigation(investigationId);
  if (!inv) notFound();

  const reference = designReference(inv);
  const view = Object.fromEntries(
    DESIGN_SECTION_IDS.map((section) => [
      section,
      reference[section].map((item) => ({
        id: item.id,
        text: <InlineText text={item.text} resolve={resolve} />,
        detail: item.detail ? <InlineText text={item.detail} resolve={resolve} /> : undefined,
      })),
    ]),
  ) as ReferenceView;

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(
            breadcrumbs([
              { name: "System design interview questions", path: "/investigations" },
              { name: inv.searchTitle, path: `/investigations/${inv.id}` },
              { name: "Design round", path: `/investigations/${inv.id}/design` },
            ]),
          ),
        }}
      />
      <PageHeader
        eyebrow={
          <Link href={`/investigations/${inv.id}`} className="hover:text-ink">
            {inv.title}
          </Link>
        }
        title={`${inv.searchTitle}, from a blank page`}
        meta={`A ${DESIGN_ROUND_MINUTES}-minute round. You drive; nothing prompts you.`}
      >
        This is how the interview actually runs: one prompt, and you decide what to cover and in what order. Write each
        section, then compare it with a reference design and see what you left out.
      </PageHeader>

      <section aria-labelledby="prompt" className="max-w-[48rem]">
        <div className="sheet overflow-hidden">
          <div className="px-5 pt-4 pb-5 sm:px-7 sm:pt-5 sm:pb-6">
            <h2 id="prompt" className="flex items-center gap-2 text-[0.75rem] font-medium text-ink-3">
              <span className="led led-accent" aria-hidden="true" />
              The prompt
            </h2>
            <div className="mt-3 text-[1.0625rem] leading-relaxed">
              <Prose text={interviewPrompt(inv.scenario)} />
            </div>
          </div>
          <details className="group border-t border-rule-soft">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 text-[0.8125rem] font-medium text-ink-2 transition-colors select-none hover:bg-hover hover:text-ink sm:px-7 [&::-webkit-details-marker]:hidden">
              What the interviewer would tell you if you asked
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className="text-ink-3 transition-transform group-open:rotate-180">
                <path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </summary>
            <div className="px-5 pb-5 sm:px-7">
              <DashList items={[...inv.constraints, ...inv.assumptions]} muted />
            </div>
          </details>
        </div>
      </section>

      <section aria-label="Your round" className="mt-10 max-w-[48rem] pb-16">
        <DesignRoundRunner
          investigationId={inv.id}
          reference={view}
          walkthroughHref={`/investigations/${inv.id}/review`}
          designExtra={
            <SystemMap
              label={`${inv.title}: the reference architecture`}
              components={inv.system.components}
              flows={inv.system.flows}
            />
          }
        />
      </section>
    </div>
  );
}
