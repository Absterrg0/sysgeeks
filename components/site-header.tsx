"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { StageBarInvestigation } from "@/components/investigation/stage-bar";
import { Brand, DesktopNav } from "@/components/site-nav";
import { DotArrow } from "@/components/icons";
import { PracticeEntryLink } from "@/components/practice-entry-link";
import { AiKeyButton } from "@/components/ai-key/ai-key-button";
import { ThemeToggle } from "@/components/theme-toggle";

const SystemBar = dynamic(() => import("@/components/investigation/system-bar").then((module) => module.SystemBar));
const ProjectBar = dynamic(() => import("@/components/investigation/system-bar").then((module) => module.ProjectBar));
const MobileNav = dynamic(() => import("@/components/site-mobile-nav").then((module) => module.MobileNav));

function preloadMobileNav() {
  void import("@/components/site-mobile-nav");
}

/**
 * The one bar at the top of every page: the brand, the sections, the AI key, and on small screens a menu.
 * Inside an investigation's stages it grows a second row for moving between them.
 */
export function SiteHeader({ investigations }: { investigations: StageBarInvestigation[] }) {
  const pathname = usePathname();
  // Inside a system, the bar grows a second row: the system's workspace.
  // The playground is its own workspace, with its own system switcher: no second row there.
  const app = pathname === "/" || /\/playground\/?$/.test(pathname);
  const match = app ? null : pathname.match(/^\/investigations\/([^/]+)/);
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
    <header className={`sticky top-0 z-40 px-2 pt-2 md:pt-3 ${app ? "sm:px-4" : "md:px-6"}`}>
      {/* A rem wider than the page's content column on each side, so the brand inside it lines up with the content.
          On the workspace screens the bar spans the window, in line with the panels under it. */}
      <div className={`nav-float relative z-10 mx-auto ${app ? "max-w-none" : "max-w-[71rem]"}`}>
        <div className="flex h-14 items-center gap-2 pr-2 pl-3 md:gap-3 md:pr-2.5 md:pl-3.5">
          <Brand onNavigate={() => setOpen(false)} />
          <DesktopNav />
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <AiKeyButton />
            <button
              type="button"
              className="knob size-10 text-ink-2 lg:size-8"
              aria-expanded={open}
              aria-controls="mobile-nav"
              aria-label={open ? "Close menu" : "Open menu"}
              onPointerEnter={preloadMobileNav}
              onFocus={preloadMobileNav}
              onTouchStart={preloadMobileNav}
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
            <PracticeEntryLink
              href="/investigations/url-shortener/playground"
              investigationId="url-shortener"
              source="header_playground"
              className="btn btn-accent group ml-1 hidden h-9 rounded-[10px] pr-3 pl-3.5 sm:inline-flex"
            >
              Open playground
              <DotArrow />
            </PracticeEntryLink>
          </div>
        </div>
        {open && (
          <div
            id="mobile-nav"
            className="max-h-[calc(100dvh-5.5rem)] overflow-y-auto border-t border-rule-soft px-2 py-4"
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
