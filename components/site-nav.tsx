"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DotMark } from "@/components/icons";
import { PRIMARY, type NavItem } from "@/components/nav-items";

const PLAYGROUND_PAGE = /^\/investigations\/[^/]+\/playground\/?$/;

export function isActive(pathname: string, href: string) {
  // A system's playground belongs to the Playground section, not to Systems.
  if (PLAYGROUND_PAGE.test(pathname)) return href === "/system-design-playground";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Brand({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      href="/"
      prefetch={false}
      onClick={onNavigate}
      className="flex w-fit shrink-0 items-center gap-2 rounded-lg px-1 py-1 text-ink"
    >
      <DotMark size={20} />
      <span className="text-[16px] leading-none font-semibold tracking-[-0.025em]">sysgeeks</span>
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

/** The few places people go most, straight after the brand on wide screens. */
export function DesktopNav() {
  return (
    <nav aria-label="Primary" className="hidden md:block">
      <ul className="flex items-center">
        {PRIMARY.map((item) => (
          <TopLink key={item.href} item={item} />
        ))}
      </ul>
    </nav>
  );
}
