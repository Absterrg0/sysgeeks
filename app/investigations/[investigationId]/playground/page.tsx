import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Playground } from "@/components/playground/playground";
import { getInvestigation, listInvestigations } from "@/lib/content";
import { playgroundProps } from "@/lib/content/playground-props";
import { PLAYGROUNDS } from "@/lib/content/playground";
import { breadcrumbs, clipDescription, jsonLd, pageMetadata, systemNameForTitle } from "@/lib/metadata";

export function generateStaticParams() {
  return listInvestigations()
    .filter((inv) => PLAYGROUNDS[inv.id])
    .map((inv) => ({ investigationId: inv.id }));
}

export const dynamicParams = false;

export async function generateMetadata(
  props: PageProps<"/investigations/[investigationId]/playground">,
): Promise<Metadata> {
  const { investigationId } = await props.params;
  const inv = getInvestigation(investigationId);
  if (!inv) return {};
  const systemName =
    inv.id === "shard-live-database"
      ? "Database Sharding"
      : systemNameForTitle(inv.searchTitle).replace(/ System$/, "");
  return pageMetadata({
    title: `System Design Playground: ${systemName}`,
    description: clipDescription(
      `Change the architecture of ${inv.title.toLowerCase()}: add caches, queues, load balancers and replicas, turn up the traffic and kill parts, and see what each change buys and costs.`,
    ),
    path: `/investigations/${inv.id}/playground`,
  });
}

export default async function PlaygroundPage(props: PageProps<"/investigations/[investigationId]/playground">) {
  const { investigationId } = await props.params;
  const play = playgroundProps(investigationId);
  if (!play) notFound();
  const inv = play.investigation;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(
            breadcrumbs([
              { name: "System design interview questions", path: "/investigations" },
              { name: inv.searchTitle, path: `/investigations/${inv.id}` },
              { name: "Playground", path: `/investigations/${inv.id}/playground` },
            ]),
          ),
        }}
      />
      <Playground {...play} />
    </>
  );
}
