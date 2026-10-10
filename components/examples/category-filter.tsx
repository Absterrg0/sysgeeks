"use client";

import { useState, type ReactNode } from "react";

export type GalleryItem = { id: string; category: string; card: ReactNode };

/** Tabs that narrow the gallery to one category; "All" shows everything. */
export function CategoryFilter({
  title,
  categories,
  items,
  aside,
}: {
  /** The first tab's label, e.g. "Examples". */
  title?: string;
  categories: { id: string; label: string }[];
  items: GalleryItem[];
  /** A quiet line at the right end of the tabs. */
  aside?: ReactNode;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const shown = picked ? items.filter((item) => item.category === picked) : items;

  return (
    <div>
      <div className="flex items-end justify-between gap-6 border-b border-rule">
        <div role="tablist" aria-label="Filter by domain" className="line-tabs -mb-px border-0">
          <button type="button" role="tab" aria-selected={picked === null} className="line-tab" onClick={() => setPicked(null)}>
            {title ?? "All"}
            <small>{items.length}</small>
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={picked === c.id}
              className="line-tab"
              onClick={() => setPicked(picked === c.id ? null : c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
        {aside && <p className="mb-3 hidden shrink-0 text-[0.75rem] text-ink-3 lg:block">{aside}</p>}
      </div>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-live="polite">
        {shown.map((item) => (
          <li key={item.id} className="min-w-0">
            {item.card}
          </li>
        ))}
      </ul>
    </div>
  );
}
