import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { IntakeForm, PastIntake } from "@/components/projects/intake/intake-form";
import { BlankProjectForm, StartOptions, type StartMethod } from "@/components/projects/start-options";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata({
  title: "New project",
  description: "Draft a system model from a description, a README or a public repository, or model it by hand.",
  path: "/projects/new",
  noindex: true,
});

const METHODS = ["description", "readme", "repository", "blank"] as const;

export default async function NewProjectPage(props: PageProps<"/projects/new">) {
  const params = await props.searchParams;
  const run = typeof params.run === "string" && params.run !== "" ? params.run : null;
  const method: StartMethod | null = METHODS.find((m) => m === params.method) ?? null;

  return (
    <div>
      <PageHeader
        title="New system"
        eyebrow={
          <Link href="/projects" className="hover:text-ink">
            Your systems
          </Link>
        }
      >
        Draft the model from what you have, or draw it by hand. Nothing is saved until you check it.
      </PageHeader>
      <div className="mt-6 grid items-start gap-5 pb-10 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <section aria-labelledby="start-heading">
          <h2 id="start-heading" className="sheet-label mb-2">
            How to start
          </h2>
          <StartOptions selected={run ? null : method} />
          <Link href="/projects/examples" className="mt-3 inline-block text-[0.8125rem] text-ink-3 hover:text-ink">
            Or open an example →
          </Link>
        </section>

        <section aria-label="System start" className="min-w-0">
          {run ? (
            <PastIntake key={run} runId={run} />
          ) : method === "blank" ? (
            <BlankProjectForm />
          ) : method ? (
            <IntakeForm key={method} method={method} />
          ) : (
            <div className="sheet px-5 py-6 text-[0.875rem] leading-relaxed text-ink-2">
              <p>
                Pick how to start. A draft reads what you give it and proposes components, flows and the things that
                must always be true. You check every item before anything is saved, and the cost is shown before you
                submit.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
