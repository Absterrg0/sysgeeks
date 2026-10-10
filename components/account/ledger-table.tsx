import type { LedgerEntry } from "@/lib/server/billing/ledger";

const KIND_LABEL: Record<string, string> = {
  welcome: "Welcome credits",
  purchase: "Credit pack",
  run: "AI run",
  "refund-clawback": "Pack refunded",
};

/** Day, month and year, in UTC so the server and the browser render the same text. */
export function formatDay(date: Date): string {
  return new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

function signed(delta: number): string {
  return delta < 0 ? `\u2212${-delta}` : `+${delta}`;
}

/** Every change to the balance, newest first. Refunds of AI runs are shown as "Refunded". */
export function LedgerTable({ entries }: { entries: readonly LedgerEntry[] }) {
  if (entries.length === 0) return <p className="text-ui text-ink-2">No credit activity yet.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Action</th>
            <th scope="col" className="text-right">
              Credits
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const refunded = entry.kind === "run-refund";
            return (
              <tr key={entry.id}>
                <td className="whitespace-nowrap tabular-nums">{formatDay(entry.createdAt)}</td>
                <td className={refunded ? "text-ink-3" : undefined}>
                  {refunded ? "Refunded" : (KIND_LABEL[entry.kind] ?? "Adjustment")}
                </td>
                <td className="whitespace-nowrap text-right font-mono tabular-nums">{signed(entry.delta)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
