import type { Metadata } from "next";
import Link from "next/link";
import { ExampleGallery } from "@/components/examples/example-gallery";
import { AppHeader } from "@/components/page-header";
import { ProjectList } from "@/components/projects/project-list";
import { listExampleProjects } from "@/lib/content/example-projects";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Your systems",
  description:
    "Model a system you built, draft it from a description, README or repository, and answer the questions an interviewer would ask about it.",
  path: "/projects",
  noindex: true,
});

export default function ProjectsPage() {
  return (
    <div>
      <AppHeader
        title="Your systems"
        description="Model a system you built, then get questioned on it the way an interviewer would."
        actions={
          <>
            <Link href="/projects/new" className="btn btn-secondary btn-sm">
              Import
            </Link>
            <Link href="/projects/new?method=blank" className="btn btn-accent btn-sm">
              New system
            </Link>
          </>
        }
      />
      <ProjectList
        examples={
          <section aria-label="Examples">
            <ExampleGallery
              examples={listExampleProjects()}
              title="Examples"
              aside="Open one to see how a finished model looks"
            />
          </section>
        }
      />
    </div>
  );
}
