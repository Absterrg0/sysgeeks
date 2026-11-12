import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SavedReport } from "@/components/ai-run/saved-report";
import { listConcepts } from "@/lib/content";

export const metadata: Metadata = {
  title: "Architecture review",
  robots: { index: false, follow: true },
};

const RUN_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A saved review. Reports live in the learner's browser, so the server renders only the shell. */
export default async function ReportPage(props: PageProps<"/reports/[runId]">) {
  const { runId } = await props.params;
  if (!RUN_ID.test(runId)) notFound();
  const concepts = Object.fromEntries(listConcepts().map((c) => [c.id, { title: c.title, summary: c.summary }]));

  return (
    <div className="section max-w-[72ch]">
      <p className="kicker">Architecture review</p>
      <div className="mt-3">
        <SavedReport runId={runId} concepts={concepts} />
      </div>
    </div>
  );
}
