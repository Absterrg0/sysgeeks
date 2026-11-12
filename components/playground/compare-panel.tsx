"use client";

import { useState } from "react";
import { useDraft } from "@/components/exercise/use-draft";
import { compareRows, faultOptions, measure, tradeOff, type Side } from "@/lib/domain/compare";
import type { PlayModel, Workload } from "@/lib/domain/playground";

type Pinned = { v: 1; model: PlayModel };

function parsePinned(raw: unknown): Pinned | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const p = raw as { v?: unknown; model?: PlayModel };
  const m = p.model;
  if (p.v !== 1 || !m || !Array.isArray(m.components) || !Array.isArray(m.flows) || !m.tuning) return undefined;
  return { v: 1, model: m };
}

const MARK: Record<"a" | "b", string> = { a: "A", b: "B" };

/**
 * Two designs side by side. Keep the current design as A, change it, and both run under the same traffic and the
 * same failure, with what each costs. Kept in this browser like the designs themselves.
 */
export function ComparePanel({
  storageKey,
  model,
  workload,
  traffic,
  regions = 1,
  prepare = (m) => m,
  trafficLabel,
  onRestore,
}: {
  storageKey: string;
  model: PlayModel;
  workload: Workload;
  /** Multiplier each design runs at (per region, for your own systems). */
  traffic: number;
  regions?: number;
  /** Applies whatever the situation imposes (a scenario's frozen settings and faults) to a design. */
  prepare?: (model: PlayModel) => PlayModel;
  trafficLabel: string;
  onRestore: (model: PlayModel) => void;
}) {
  const [pinned, pin, unpin] = useDraft<Pinned | undefined>(storageKey, parsePinned, () => undefined);
  const [faultId, setFaultId] = useState("none");
  const a = pinned?.model;
  const options = faultOptions(a ? [a, model] : [model]);
  const option = options.find((o) => o.id === faultId) ?? options[0];

  if (!a) {
    return (
      <section aria-labelledby="compare" className="mt-8">
        <h2 id="compare" className="font-display text-[1.25rem] tracking-[-0.015em]">
          Compare two designs
        </h2>
        <div className="plate mt-3 flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
          <p className="max-w-[60ch] text-[0.875rem] leading-relaxed text-ink-2">
            Keep this design as A, then change it. Both run side by side under the same traffic and the same failure, so
            you can say what each one buys and what it costs.
          </p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => pin({ v: 1, model })}>
            Keep this as A
          </button>
        </div>
      </section>
    );
  }

  const fault = option?.fault ?? null;
  const ma = measure(prepare(a), workload, traffic, fault, regions);
  const mb = measure(prepare(model), workload, traffic, fault, regions);
  const rows = compareRows(ma, mb);
  const same = JSON.stringify(a) === JSON.stringify(model);

  const cell = (value: string, side: "a" | "b", better: Side) => (
    <td className={`text-right font-mono tabular-nums ${better === side ? "text-ink" : "text-ink-3"}`}>
      {better === side && (
        <span className="led led-strong mr-2 align-middle" aria-hidden="true" />
      )}
      {value}
      {better === side && <span className="sr-only"> (better)</span>}
    </td>
  );

  return (
    <section aria-labelledby="compare" className="mt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="compare" className="font-display text-[1.25rem] tracking-[-0.015em]">
          Compare two designs
        </h2>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={same}
            onClick={() => onRestore(a)}
            title="Put design A back on the screen"
          >
            Go back to A
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={same}
            onClick={() => pin({ v: 1, model })}
          >
            Keep this as A instead
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => unpin()}>
            Stop comparing
          </button>
        </div>
      </div>
      <div className="plate mt-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-rule-soft px-4 py-2.5 sm:px-5">
          <label htmlFor={`${storageKey}-fault`} className="text-[0.8125rem] text-ink-3">
            At {trafficLabel}, with
          </label>
          <select
            id={`${storageKey}-fault`}
            value={option?.id ?? "none"}
            onChange={(e) => setFaultId(e.target.value)}
            className="field w-auto min-w-0 max-w-full py-1 text-[0.8125rem]"
          >
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table min-w-[30rem] [&_td]:px-4 [&_th]:px-4">
            <thead>
              <tr>
                <th scope="col">Same traffic, same failure</th>
                <th scope="col" className="text-right">
                  A · kept
                </th>
                <th scope="col" className="text-right">
                  B · on screen
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <th scope="row" className="font-normal text-ink-2">
                    {r.label}
                  </th>
                  {cell(r.a, "a", r.better)}
                  {cell(r.b, "b", r.better)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-rule-soft px-4 py-3 text-[0.875rem] leading-relaxed text-ink-2 sm:px-5" aria-live="polite">
          {same ? "B is the same design as A. Change something to compare." : tradeOff(rows)}
          {!same && (
            <span className="ml-1 text-ink-3">
              The dot marks the better side of each row ({MARK.a} or {MARK.b}); fewer instances is cheaper, not always
              better.
            </span>
          )}
        </p>
      </div>
    </section>
  );
}
