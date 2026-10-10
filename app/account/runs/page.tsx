import { AccountUnavailable } from "@/components/account/account-unavailable";
import { LedgerTable } from "@/components/account/ledger-table";
import { RunsList, type RunRow } from "@/components/account/runs-list";
import { Section } from "@/components/page-header";
import { pageMetadata } from "@/lib/metadata";
import { openAccount, type AccountScope } from "@/lib/server/account-scope";
import { listLedger, listRuns } from "@/lib/server/billing/ledger";

export const metadata = pageMetadata({
  title: "Usage and runs",
  description: "Your credit history and the AI runs saved to your account.",
  path: "/account/runs",
  noindex: true,
});

const RUN_LIMIT = 50;

/** Runs whose output is still saved. The run list does not say, so this asks for the same rows directly. */
async function savedRunIds({ db, userId }: AccountScope): Promise<Set<string>> {
  const rows = await db.query<{ id: string }>(
    `select id::text as id from ai_runs
     where user_id = $1::text and output is not null
     order by created_at desc, id desc limit $2::int`,
    [userId, RUN_LIMIT],
  );
  return new Set(rows.map((row) => row.id));
}

export default async function AccountRunsPage() {
  const scope = await openAccount("/account/runs");
  if (typeof scope === "string") return <AccountUnavailable reason={scope} />;

  const [entries, runs, saved] = await Promise.all([
    listLedger(scope.db, scope.userId),
    listRuns(scope.db, scope.userId, { limit: RUN_LIMIT }),
    savedRunIds(scope),
  ]);
  const rows: RunRow[] = runs.map((run) => ({
    id: run.id,
    feature: run.feature,
    status: run.status,
    credits: run.credits,
    refunded: run.refunded,
    title: run.title,
    createdAt: run.createdAt,
    hasOutput: saved.has(run.id),
  }));

  return (
    <div className="space-y-12">
      <Section
        id="ledger"
        title="Credit history"
        description="Every change to your balance. A run is charged when it starts and refunded if it fails."
      >
        <LedgerTable entries={entries} />
      </Section>
      <Section
        id="runs"
        title="AI runs"
        description="Reports and drafts are saved here so you can open them on any device. You can delete a run's saved output at any time."
      >
        <RunsList runs={rows} />
      </Section>
    </div>
  );
}
