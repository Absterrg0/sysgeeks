import type { Metadata } from "next";
import { ProjectWorkspace } from "@/components/projects/project-workspace";
import { getCompany, listConcepts, listWriteups } from "@/lib/content";

export const metadata: Metadata = { title: "Project", robots: { index: false, follow: true } };

/** Projects live in the learner's browser, so the server renders only the shell. */
export default async function ProjectPage(props: PageProps<"/projects/[projectId]">) {
  const { projectId } = await props.params;
  const concepts = Object.fromEntries(listConcepts().map((c) => [c.id, { title: c.title, summary: c.summary }]));
  // For the playground's insights to point at; no notes, to keep the page light.
  const writeups = listWriteups().map((w) => ({
    id: w.id,
    title: w.title,
    url: w.url,
    company: getCompany(w.companyId)?.name ?? w.companyId,
    note: "",
    conceptIds: w.conceptIds,
    forThis: false,
  }));
  return (
    <div>
      <ProjectWorkspace projectId={projectId} concepts={concepts} writeups={writeups} />
    </div>
  );
}
