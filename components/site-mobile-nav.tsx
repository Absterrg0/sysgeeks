"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LEARN, YOURS, type NavItem } from "@/components/nav-items";
import { isActive } from "@/components/site-nav";

/**
 * The menu that drops from the bar at every width: everything the bar leaves out, as a Kura popover grid.
 * Loaded when the menu is first opened.
 */
export function MobileNav({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  const group = (title: string, items: NavItem[], columns: string) => (
    <div className="min-w-0">
      <p className="kicker mb-1.5 px-2.5">{title}</p>
      <ul className={`grid gap-0.5 ${columns}`}>
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href} className="min-w-0">
              <Link
                href={item.href}
                prefetch={false}
                aria-current={active ? "page" : undefined}
                onClick={onNavigate}
                className={`group flex items-start gap-3 rounded-[10px] px-2.5 py-2 transition-colors ${
                  active ? "bg-[color-mix(in_srgb,var(--ink)_5%,transparent)]" : "hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)]"
                }`}
              >
                <span
                  className={`mt-px grid size-7 shrink-0 place-items-center rounded-[8px] bg-raised shadow-[var(--shadow-key)] ${
                    active ? "text-ink" : "text-ink-3 group-hover:text-ink"
                  }`}
                >
                  {item.icon}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-[0.875rem] leading-snug font-medium text-ink">
                    {item.label}
                    {active && <span className="size-[5px] rounded-full bg-accent-solid" aria-hidden="true" />}
                  </span>
                  <span className="mt-0.5 block truncate text-[0.75rem] leading-snug text-ink-3">{item.description}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <nav aria-label="Menu" className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)] lg:gap-6 lg:pr-2">
      {group("Learn", LEARN, "sm:grid-cols-2 lg:grid-cols-3")}
      {group("Yours", YOURS, "")}
    </nav>
  );
}
