"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PixelMark } from "@/components/icons";
import { LEARN, YOURS, type NavItem } from "@/components/nav-items";

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Brand({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      href="/"
      prefetch={false}
      onClick={onNavigate}
      className="flex w-fit shrink-0 items-center gap-2.5 rounded-md"
    >
      <PixelMark size={24} />
      <span className="font-pixel text-[1.125rem] leading-none tracking-[0.01em] text-ink">
        sys<span className="text-ink-3">geeks</span>
      </span>
    </Link>
  );
}

function TopLink({ item, label = item.label }: { item: NavItem; label?: string }) {
  const pathname = usePathname();
  return (
    <li>
      <Link
        href={item.href}
        prefetch={false}
        aria-current={isActive(pathname, item.href) ? "page" : undefined}
        className="nav-link"
      >
        {label}
      </Link>
    </li>
  );
}

/** The library on wide screens, straight after the brand. */
export function DesktopNav() {
  return (
    <nav aria-label="Primary" className="hidden lg:block">
      <ul className="flex items-center gap-0.5">
        {LEARN.map((item) => (
          <TopLink key={item.href} item={item} />
        ))}
      </ul>
    </nav>
  );
}

/** Your own work, on the right of the bar on wide screens, before the account menu. */
export function DesktopLinks() {
  return (
    <nav aria-label="Yours" className="hidden lg:block">
      <ul className="flex items-center gap-0.5">
        {YOURS.map((item) => (
          <TopLink key={item.href} item={item} />
        ))}
      </ul>
    </nav>
  );
}
