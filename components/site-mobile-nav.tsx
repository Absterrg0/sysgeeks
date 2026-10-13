"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LEARN, YOURS, type NavItem } from "@/components/nav-items";
import { isActive } from "@/components/site-nav";

/** The full menu for small screens; loaded when the menu is first opened. */
export function MobileNav({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  const group = (title: string, items: NavItem[]) => (
    <div>
      <p className="eyebrow mb-2 px-1 text-ink-3">{title}</p>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                prefetch={false}
                aria-current={active ? "page" : undefined}
                onClick={onNavigate}
                className={`flex items-start gap-3 rounded-xl px-3 py-3 transition-[background-color,box-shadow] ${
                  active ? "bg-raised shadow-[var(--shadow-btn)]" : "hover:bg-hover"
                }`}
              >
                <span className={`mt-0.5 ${active ? "text-ink" : "text-ink-3"}`}>{item.icon}</span>
                <span className="min-w-0">
                  <span className="block text-[0.9375rem] font-medium leading-snug">{item.label}</span>
                  <span className="mt-0.5 block text-[0.8125rem] leading-snug text-ink-2">{item.description}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <nav aria-label="Primary" className="space-y-6">
      {group("Learn", LEARN)}
      {group("Yours", YOURS)}
    </nav>
  );
}
