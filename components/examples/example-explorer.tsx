"use client";

import { useState, type ReactNode } from "react";
import { FLOW_LABEL, FlowLine, KIND_LABEL, SystemMap } from "@/components/system-map";
import type { ArchitectureFlow, FlowKind, Invariant, PlacedComponent } from "@/lib/domain/content";

/**
 * The map with its parts, flows and invariants as tables under it, sharing one selection: pick a part on the
 * map or in a table and its flows light up in both, and hovering a flow traces it on the map.
 */
export function ExampleExplorer({
  name,
  components,
  flows,
  invariants,
  rail,
}: {
  name: string;
  /** Shown beside the tables on wide screens. */
  rail?: ReactNode;
  components: PlacedComponent[];
  flows: ArchitectureFlow[];
  invariants: Invariant[];
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [hoveredFlow, setHoveredFlow] = useState<string | null>(null);
  const labels = new Map(components.map((c) => [c.id, c.label]));
  const touches = (f: ArchitectureFlow) => selected !== null && (f.from === selected || f.to === selected);
  const kinds = [...new Set(flows.map((f) => f.kind))] as FlowKind[];
  const toggle = (id: string) => setSelected((current) => (current === id ? null : id));
  const selectedLabel = selected ? labels.get(selected) : undefined;

  return (
    <>
      <SystemMap
        components={components}
        flows={flows}
        label={`${name} architecture`}
        selectedId={selected}
        onSelect={setSelected}
        highlightFlows={hoveredFlow ? [hoveredFlow] : []}
        hideDetails
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-[0.75rem] text-ink-3">
        <p aria-live="polite">
          {selectedLabel ? (
            <>
              Showing the flows of <span className="text-ink">{selectedLabel}</span>.{" "}
              <button type="button" className="link" onClick={() => setSelected(null)}>
                Show all
              </button>
            </>
          ) : (
            "Select a part to trace its flows."
          )}
        </p>
        {kinds.length > 1 && (
          <ul className="flex flex-wrap gap-x-5 gap-y-1" aria-label="Line styles">
            {kinds.map((kind) => (
              <li key={kind} className="flex items-center gap-2">
                <FlowLine kind={kind} />
                {FLOW_LABEL[kind]}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-10 grid items-start gap-x-8 gap-y-10 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="min-w-0 space-y-10">
        <section aria-labelledby="parts">
          <Heading id="parts" count={components.length}>
            Parts
          </Heading>
          <div className="sheet overflow-hidden">
            <div className="hidden grid-cols-[13rem_minmax(0,1fr)_minmax(0,13rem)] gap-6 border-b border-rule-soft px-4 py-2 text-[0.71875rem] text-ink-3 md:grid">
              <span>Part</span>
              <span>Responsible for</span>
              <span>Owns</span>
            </div>
            <ul>
              {components.map((c) => {
                const active = selected === c.id;
                return (
                  <li key={c.id} className="sheet-row">
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggle(c.id)}
                      className={`grid w-full gap-x-6 gap-y-1 px-4 py-3 text-left transition-colors md:grid-cols-[13rem_minmax(0,1fr)_minmax(0,13rem)] ${
                        active ? "bg-accent-soft" : "hover:bg-[color-mix(in_srgb,var(--hover)_70%,transparent)]"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[0.875rem] font-medium text-ink">{c.label}</span>
                        <span className="block font-mono text-[0.6875rem] text-ink-3">{KIND_LABEL[c.kind]}</span>
                      </span>
                      <span className="text-[0.8125rem] leading-relaxed text-ink-2">{c.responsibility}</span>
                      <span className="text-[0.8125rem] leading-relaxed text-ink-2">
                        {c.durableState ? (
                          <>
                            <span className="text-ink-3 md:hidden">Owns: </span>
                            {c.durableState}
                          </>
                        ) : (
                          <span className="text-ink-3 max-md:hidden" aria-label="Nothing">
                            —
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <section aria-labelledby="flows">
          <Heading id="flows" count={flows.length}>
            Flows
          </Heading>
          <div className="sheet overflow-hidden">
            <ol onMouseLeave={() => setHoveredFlow(null)}>
              {flows.map((f, i) => {
                const dimmed = selected !== null && !touches(f);
                return (
                  <li
                    key={f.id}
                    className={`sheet-row grid grid-cols-[1.5rem_minmax(0,1fr)] items-baseline gap-x-3 gap-y-0.5 px-4 py-2.5 transition-opacity md:grid-cols-[1.5rem_minmax(0,17rem)_minmax(0,1fr)_9.5rem] ${
                      dimmed ? "opacity-35" : ""
                    } ${touches(f) ? "bg-accent-soft" : ""}`}
                    onMouseEnter={() => setHoveredFlow(f.id)}
                  >
                    <span className="font-mono text-[0.6875rem] tabular-nums text-ink-3">{i + 1}</span>
                    <span className="min-w-0 truncate text-[0.8125rem] text-ink">
                      {labels.get(f.from)} <span className="text-ink-3">→</span> {labels.get(f.to)}
                    </span>
                    <span className="text-[0.8125rem] text-ink-2 max-md:col-start-2">{f.label}</span>
                    <span className="flex items-center gap-2 text-[0.75rem] text-ink-3 max-md:col-start-2">
                      <FlowLine kind={f.kind} width={18} />
                      {FLOW_LABEL[f.kind]}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        <section aria-labelledby="invariants">
          <Heading id="invariants" count={invariants.length}>
            Invariants
          </Heading>
          <ul className="sheet overflow-hidden">
            {invariants.map((inv) => {
              const dimmed = selected !== null && !inv.enforcedBy.includes(selected);
              return (
                <li
                  key={inv.id}
                  className={`sheet-row grid gap-x-6 gap-y-2 px-4 py-3.5 transition-opacity md:grid-cols-[minmax(0,1fr)_13rem] ${
                    dimmed ? "opacity-35" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-[0.875rem] font-medium text-ink">{inv.statement}</p>
                    <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-2">{inv.mechanism}</p>
                  </div>
                  <div>
                    <p className="text-[0.71875rem] text-ink-3">Kept by</p>
                    <ul className="mt-1 flex flex-wrap gap-1.5">
                      {inv.enforcedBy.map((id) => (
                        <li key={id}>
                          <button
                            type="button"
                            aria-pressed={selected === id}
                            onClick={() => toggle(id)}
                            className="chip-flat hover:text-ink aria-pressed:text-ink"
                          >
                            {labels.get(id) ?? id}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
      {rail}
      </div>
    </>
  );
}

function Heading({ id, count, children }: { id: string; count: number; children: string }) {
  return (
    <h2 id={id} className="mb-2.5 flex items-baseline gap-2 text-[0.8125rem] font-semibold">
      {children} <span className="font-mono text-[0.6875rem] font-normal text-ink-3">{count}</span>
    </h2>
  );
}
