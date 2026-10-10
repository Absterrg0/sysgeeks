"use client";

import { useEffect, useState } from "react";

const STARTING_VALUES = {
  dailyActiveUsers: "10000000",
  writesPerUserPerDay: "2",
  readsPerWrite: "100",
  peakFactor: "3",
  recordBytes: "500",
  retentionYears: "5",
  readResponseKb: "1",
  writeRequestKb: "0.25",
  storageOverheadPercent: "50",
  storedCopies: "3",
};

type FieldName = keyof typeof STARTING_VALUES;

const URL_FIELDS: Record<FieldName, string> = {
  dailyActiveUsers: "dau",
  writesPerUserPerDay: "writes",
  readsPerWrite: "reads",
  peakFactor: "peak",
  recordBytes: "recordBytes",
  retentionYears: "years",
  readResponseKb: "readKb",
  writeRequestKb: "writeKb",
  storageOverheadPercent: "overhead",
  storedCopies: "copies",
};

const numberFormat = new Intl.NumberFormat("en", { maximumSignificantDigits: 3 });

function formatNumber(value: number) {
  return numberFormat.format(value);
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "kB", "MB", "GB", "TB", "PB"];
  let amount = value;
  let unit = 0;
  while (amount >= 1_000 && unit < units.length - 1) {
    amount /= 1_000;
    unit += 1;
  }
  return `${formatNumber(amount)} ${units[unit]}`;
}

function NumberField({
  id,
  label,
  value,
  unit,
  help,
  min = "0",
  step = "1",
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  unit: string;
  help: string;
  min?: string;
  step?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-[0.875rem] font-medium">
        {label}
      </label>
      <div className="relative mt-1.5">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          step={step}
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
          className="field pr-16 font-mono tabular-nums"
        />
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[0.75rem] text-ink-3">
          {unit}
        </span>
      </div>
      <p className="mt-1.5 text-[0.75rem] leading-snug text-ink-3">{help}</p>
    </div>
  );
}

function EstimateLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-rule-soft py-2.5 last:border-0">
      <dt className="text-[0.8125rem] text-ink-2">{label}</dt>
      <dd className="text-right font-mono text-[0.8125rem] tabular-nums">{value}</dd>
    </div>
  );
}

export function CapacityEstimator() {
  const [values, setValues] = useState(STARTING_VALUES);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (![...Object.values(URL_FIELDS)].some((key) => params.has(key))) return;

    setValues((current) => {
      const next = { ...current };
      for (const [field, key] of Object.entries(URL_FIELDS) as [FieldName, string][]) {
        const value = params.get(key);
        const parsed = Number(value);
        const minimum = field === "peakFactor" || field === "storedCopies" ? 1 : 0;
        if (value !== null && value.trim() !== "" && Number.isFinite(parsed) && parsed >= minimum) {
          next[field] = value;
        }
      }
      return next;
    });
  }, []);

  const update = (key: FieldName, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setCopyState("idle");
  };
  const copyEstimateLink = async () => {
    const url = new URL(window.location.href);
    url.search = "";
    for (const [field, key] of Object.entries(URL_FIELDS) as [FieldName, string][]) {
      url.searchParams.set(key, values[field]);
    }

    try {
      await navigator.clipboard.writeText(url.toString());
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  };
  const positive = (key: FieldName) => {
    const parsed = Number(values[key]);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  };

  const activeUsers = positive("dailyActiveUsers");
  const writesPerUserPerDay = positive("writesPerUserPerDay");
  const readsPerWrite = positive("readsPerWrite");
  const peakFactor = Math.max(1, positive("peakFactor"));
  const recordBytes = positive("recordBytes");
  const retentionYears = positive("retentionYears");
  const readResponseBytes = positive("readResponseKb") * 1_000;
  const writeRequestBytes = positive("writeRequestKb") * 1_000;
  const storageOverhead = 1 + positive("storageOverheadPercent") / 100;
  const storedCopies = Math.max(1, positive("storedCopies"));

  const writesPerDay = activeUsers * writesPerUserPerDay;
  const readsPerDay = writesPerDay * readsPerWrite;
  const averageWriteQps = writesPerDay / 86_400;
  const averageReadQps = readsPerDay / 86_400;
  const peakWriteQps = averageWriteQps * peakFactor;
  const peakReadQps = averageReadQps * peakFactor;
  const rawStorage = writesPerDay * recordBytes * 365 * retentionYears;
  const logicalStorage = rawStorage * storageOverhead;
  const physicalStorage = logicalStorage * storedCopies;
  const peakIngress = peakWriteQps * writeRequestBytes;
  const peakEgress = peakReadQps * readResponseBytes;

  return (
    <section aria-label="Capacity estimator" className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <div className="sheet p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="kicker">Workload assumptions</p>
            <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-3">
              Change a value to see how the estimate moves. Start with a rough number; refine it only when it changes a design choice.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setValues(STARTING_VALUES);
              setCopyState("idle");
            }}
          >
            Use URL shortener example
          </button>
        </div>

        <div className="mt-6 grid gap-x-5 gap-y-5 sm:grid-cols-2">
          <NumberField
            id="capacity-dau"
            label="Daily active users"
            value={values.dailyActiveUsers}
            unit="users"
            help="People who use the system on a typical day."
            onChange={(value) => update("dailyActiveUsers", value)}
          />
          <NumberField
            id="capacity-writes-per-user"
            label="Writes per user per day"
            value={values.writesPerUserPerDay}
            unit="writes"
            help="Creates, posts, uploads, or other durable changes."
            step="any"
            onChange={(value) => update("writesPerUserPerDay", value)}
          />
          <NumberField
            id="capacity-reads-per-write"
            label="Reads per write"
            value={values.readsPerWrite}
            unit="reads"
            help="A read-to-write ratio of 100 means 100 reads for each write."
            step="any"
            onChange={(value) => update("readsPerWrite", value)}
          />
          <NumberField
            id="capacity-peak-factor"
            label="Peak-to-average factor"
            value={values.peakFactor}
            unit="×"
            help="Peak traffic as a multiple of the daily average; minimum 1×."
            min="1"
            step="any"
            onChange={(value) => update("peakFactor", value)}
          />
          <NumberField
            id="capacity-record-bytes"
            label="Stored bytes per write"
            value={values.recordBytes}
            unit="bytes"
            help="The average durable record size before indexes and replicas."
            step="any"
            onChange={(value) => update("recordBytes", value)}
          />
          <NumberField
            id="capacity-retention-years"
            label="Retention"
            value={values.retentionYears}
            unit="years"
            help="How long those records remain stored; uses 365 days per year."
            step="any"
            onChange={(value) => update("retentionYears", value)}
          />
          <NumberField
            id="capacity-read-kb"
            label="Read response size"
            value={values.readResponseKb}
            unit="kB"
            help="Average response payload; 1 kB is 1,000 bytes."
            step="any"
            onChange={(value) => update("readResponseKb", value)}
          />
          <NumberField
            id="capacity-write-kb"
            label="Write request size"
            value={values.writeRequestKb}
            unit="kB"
            help="Average inbound payload for each write."
            step="any"
            onChange={(value) => update("writeRequestKb", value)}
          />
          <NumberField
            id="capacity-overhead"
            label="Index and metadata overhead"
            value={values.storageOverheadPercent}
            unit="%"
            help="Extra logical storage beyond the raw records."
            step="any"
            onChange={(value) => update("storageOverheadPercent", value)}
          />
          <NumberField
            id="capacity-copies"
            label="Stored copies, including primary"
            value={values.storedCopies}
            unit="copies"
            help="A replication factor of 3 counts the primary and two replicas."
            min="1"
            step="any"
            onChange={(value) => update("storedCopies", value)}
          />
        </div>
      </div>

      <div className="space-y-4">
        <section aria-label="Share this estimate" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rule-soft bg-raised px-4 py-3">
          <p className="text-[0.8125rem] leading-snug text-ink-2">Share these assumptions or reopen them later.</p>
          <div className="flex items-center gap-2">
            <p aria-live="polite" className="text-[0.75rem] text-ink-3">
              {copyState === "copied" ? "Link copied" : copyState === "failed" ? "Copy failed; check browser permissions." : null}
            </p>
            <button type="button" className="btn btn-secondary btn-sm" onClick={copyEstimateLink}>
              Copy estimate link
            </button>
          </div>
        </section>
        <section aria-labelledby="capacity-summary" className="screen p-5 sm:p-6">
          <p className="kicker">Estimated at peak</p>
          <h2 id="capacity-summary" className="sr-only">Estimated system capacity</h2>
          <div className="mt-3 grid gap-3">
            <div className="rounded-xl border border-rule-soft bg-raised p-4">
              <p className="text-[0.75rem] text-ink-3">Combined read + write QPS</p>
              <output className="mt-1 block font-display text-[1.625rem] leading-tight tabular-nums">
                {formatNumber(peakReadQps + peakWriteQps)}
              </output>
            </div>
            <div className="rounded-xl border border-rule-soft bg-raised p-4">
              <p className="text-[0.75rem] text-ink-3">Physical storage</p>
              <output className="mt-1 block font-display text-[1.625rem] leading-tight tabular-nums">
                {formatBytes(physicalStorage)}
              </output>
            </div>
            <div className="rounded-xl border border-rule-soft bg-raised p-4">
              <p className="text-[0.75rem] text-ink-3">Peak read egress</p>
              <output className="mt-1 block font-display text-[1.625rem] leading-tight tabular-nums">
                {formatBytes(peakEgress)}/s
              </output>
            </div>
          </div>
        </section>

        <section aria-labelledby="capacity-breakdown" className="sheet p-5 sm:p-6">
          <h2 id="capacity-breakdown" className="font-heading text-[1rem]">Workload breakdown</h2>
          <div className="mt-2">
            <h3 className="kicker mb-1">Traffic</h3>
            <dl>
              <EstimateLine label="Writes per day" value={formatNumber(writesPerDay)} />
              <EstimateLine label="Reads per day" value={formatNumber(readsPerDay)} />
              <EstimateLine label="Average write QPS" value={formatNumber(averageWriteQps)} />
              <EstimateLine label="Peak write QPS" value={formatNumber(peakWriteQps)} />
              <EstimateLine label="Average read QPS" value={formatNumber(averageReadQps)} />
              <EstimateLine label="Peak read QPS" value={formatNumber(peakReadQps)} />
            </dl>
          </div>
          <div className="mt-4">
            <h3 className="kicker mb-1">Storage</h3>
            <dl>
              <EstimateLine label="Raw retained data" value={formatBytes(rawStorage)} />
              <EstimateLine label="With index / metadata overhead" value={formatBytes(logicalStorage)} />
              <EstimateLine label="Across all stored copies" value={formatBytes(physicalStorage)} />
            </dl>
          </div>
          <div className="mt-4">
            <h3 className="kicker mb-1">Peak network throughput</h3>
            <dl>
              <EstimateLine label="Write ingress" value={`${formatBytes(peakIngress)}/s`} />
              <EstimateLine label="Read egress" value={`${formatBytes(peakEgress)}/s`} />
            </dl>
          </div>
        </section>
      </div>
    </section>
  );
}
