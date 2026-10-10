"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AccountMenu } from "@/components/account/account-menu";
import { LiveCredits } from "@/components/account/live-credits";
import { CreditsChip } from "@/components/billing-ui";
import type { StageBarInvestigation } from "@/components/investigation/stage-bar";
import { ProjectBar, SystemBar } from "@/components/investigation/system-bar";
import { Brand, DesktopLinks, DesktopNav, MobileNav } from "@/components/site-nav";
import { ThemeToggle } from "@/components/theme-toggle";

export type HeaderCredits = { balance: number; allotment?: number; renewsAt?: Date | null };

/**
 * The one bar at the top of every page: the brand, the sections, the account, and on small screens a menu.
 * Inside an investigation's stages it grows a second row for moving between them.
 */
export function SiteHeader({
  investigations,
  auth,
  credits,
}: {
  investigations: StageBarInvestigation[];
  auth: boolean;
  credits?: HeaderCredits;
}) {
  const pathname = usePathname();
  // Inside a system, the bar grows a second row: the system's workspace.
  const match = pathname.match(/^\/investigations\/([^/]+)/);
  const investigation = match ? investigations.find((inv) => inv.id === match[1]) : undefined;
  const project = pathname.match(/^\/projects\/(?!new$|examples(?:\/|$))([^/]+)\/?$/)?.[1];
  const [open, setOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState(pathname);

  // Navigating anywhere, including back and forward, closes the menu.
  if (open && openedAt !== pathname) {
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-4 sm:pt-4 lg:px-6">
      {/* A rem wider than the page's content column on each side, so the brand inside it lines up with the content. */}
      <div className="nav-float relative z-10 mx-auto max-w-[71rem]">
        <div className="flex h-14 items-center gap-6 pr-2 pl-4">
          <Brand onNavigate={() => setOpen(false)} />
          <DesktopNav />
          <div className="ml-auto flex items-center gap-1.5">
            <DesktopLinks />
            <ThemeToggle />
            <AccountMenu auth={auth} credits={credits ? <CreditsChip {...credits} /> : <LiveCredits />} />
            {!auth && (
              <Link
                href="/investigations"
                prefetch={false}
                className="btn btn-accent btn-sm ml-1.5 hidden sm:inline-flex"
              >
                Start
              </Link>
            )}
            <button
              type="button"
              className="knob size-10 text-ink lg:hidden"
              aria-expanded={open}
              aria-controls="mobile-nav"
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => {
                setOpenedAt(pathname);
                setOpen((v) => !v);
              }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path
                  d={open ? "M4.5 4.5l9 9M13.5 4.5l-9 9" : "M3 6h12M3 12h12"}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>
        {open && (
          <div
            id="mobile-nav"
            className="max-h-[calc(100dvh-5.5rem)] overflow-y-auto border-t border-rule-soft px-2 py-4 lg:hidden"
          >
            <MobileNav onNavigate={() => setOpen(false)} />
          </div>
        )}
      </div>
      {/* Inside a system, its workspace slides out from under the bar. */}
      {(investigation || project) && !open && (
        <div className="mx-auto max-w-[71rem] px-3 sm:px-5">
          {investigation && <SystemBar investigation={investigation} path={pathname} />}
          {project && <ProjectBar projectId={project} />}
        </div>
      )}
    </header>
  );
}
