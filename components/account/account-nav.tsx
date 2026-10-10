"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/account", label: "Overview" },
  { href: "/account/runs", label: "Usage & runs" },
  { href: "/account/data", label: "Data" },
] as const;

/** A ruled list beside the page on desktop, a horizontally scrolling tab row on mobile. */
export function AccountNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Account"
      className="tabs md:w-48 md:shrink-0 md:flex-col md:gap-0 md:border-b-0 md:border-r md:border-rule"
    >
      {ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={pathname === item.href ? "page" : undefined}
          className="tab text-ui aria-[current=page]:text-ink md:border-b md:border-rule-soft md:py-3 md:pr-4"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
