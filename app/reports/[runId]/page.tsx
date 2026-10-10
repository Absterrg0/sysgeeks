import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { Callout } from "@/components/feedback";
import { ReportView } from "@/components/projects/review/report-view";
import { getConcept } from "@/lib/content";
import { features } from "@/lib/config";
import { currentUserId } from "@/lib/server/auth";
import { getRun } from "@/lib/server/billing/ledger";
import { getDb } from "@/lib/server/db";

export const metadata: Metadata = {
  title: "Architecture review",
  robots: { index: false, follow: true },
};

export const dynamic = "force-dynamic";

const RUN_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Shape only. The generation schema's length and format limits are not re-applied here, so a stored paid report
 * still renders after those limits change.
 */
const StoredReviewSchema = z.object({
  summary: z.string(),
  strengths: z.array(
    z.object({ title: z.string(), detail: z.string(), componentIds: z.array(z.string()) }),
  ),
  findings: z.array(
    z.object({
      id: z.string(),
      category: z.enum([
        "bottleneck",
        "failure-mode",
        "missing-invariant",
        "consistency",
        "scaling-cliff",
        "security",
        "operability",
      ]),
      severity: z.enum(["high", "medium", "low"]),
      confidence: z.enum(["high", "medium", "low"]),
      title: z.string(),
      scenario: z.string(),
      impact: z.string(),
      recommendation: z.string(),
      tradeoff: z.string(),
      componentIds: z.array(z.string()),
      flowIds: z.array(z.string()),
      conceptIds: z.array(z.string()),
      assumes: z.string().optional(),
    }),
  ),
  suggestedInvariants: z.array(
    z.object({ statement: z.string(), enforcedBy: z.array(z.string()), mechanism: z.string() }),
  ),
  questionsToAsk: z.array(z.string()),
});

function reviewOf(output: unknown): unknown {
  return typeof output === "object" && output !== null && "review" in output ? output.review : undefined;
}

/** A saved review, readable by its owner only. Signed-out visitors go to sign-in; anyone else gets a 404. */
export default async function ReportPage(props: PageProps<"/reports/[runId]">) {
  const { runId } = await props.params;
  if (!RUN_ID.test(runId)) notFound();

  const userId = await currentUserId();
  if (!userId) {
    if (features().auth) redirect(`/sign-in?redirect_url=/reports/${runId}`);
    notFound();
  }

  const db = getDb();
  const run = db ? await getRun(db, userId, runId) : null;
  if (!run || run.status !== "succeeded") notFound();

  const parsed = StoredReviewSchema.safeParse(reviewOf(run.output));

  return (
    <div className="section max-w-[72ch]">
      <p className="kicker">Architecture review</p>
      <h1 className="mt-3 font-display text-[1.875rem] leading-[1.1] text-balance sm:text-[2.25rem]">
        {run.title ?? "Architecture review"}
      </h1>
      {run.projectId && (
        <p className="mt-3 text-small text-ink-2">
          <Link href={`/projects/${run.projectId}`} className="link">
            Back to the project
          </Link>
        </p>
      )}
      <div className="mt-8">
        {parsed.success ? (
          <ReportView review={parsed.data} resolve={(id) => getConcept(id)} createdAt={run.createdAt} />
        ) : (
          <Callout tone="failure" title="This report couldn't be displayed">
            <p>
              The saved output for this run can&rsquo;t be read, so the review can&rsquo;t be shown here. Run ID:{" "}
              <span className="font-mono">{runId}</span>.
            </p>
          </Callout>
        )}
      </div>
    </div>
  );
}
