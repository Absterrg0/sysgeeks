import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExampleDetail } from "@/components/examples/example-detail";
import { getExampleProject, listExampleProjects } from "@/lib/content/example-projects";
import { breadcrumbs, clipDescription, jsonLd, pageMetadata } from "@/lib/metadata";

export function generateStaticParams() {
  return listExampleProjects().map((e) => ({ exampleId: e.id }));
}

export const dynamicParams = false;

/** "Ride hailing dispatch (example)" → "Ride hailing dispatch": the page title already says it is an example. */
const plainName = (name: string) => name.replace(/\s*\(example\)$/, "");

export async function generateMetadata(props: PageProps<"/projects/examples/[exampleId]">): Promise<Metadata> {
  const { exampleId } = await props.params;
  const example = getExampleProject(exampleId);
  if (!example) return {};
  return pageMetadata({
    title: `${plainName(example.name)}: System Design Example`,
    description:
      example.id === "ml-inference-api"
        ? "Practice designing an ML inference API: batch requests on GPU workers, load models by version, enforce per-customer rate limits, and meter usage."
        : clipDescription(example.summary),
    path: `/projects/examples/${example.id}`,
  });
}

export default async function ExamplePage(props: PageProps<"/projects/examples/[exampleId]">) {
  const { exampleId } = await props.params;
  const example = getExampleProject(exampleId);
  if (!example) notFound();

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@graph": [
              breadcrumbs([
                { name: "System design examples", path: "/projects/examples" },
                { name: plainName(example.name), path: `/projects/examples/${example.id}` },
              ]),
            ],
          }),
        }}
      />
      <ExampleDetail example={example} />
    </div>
  );
}
