"use client";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const PRIVATE_PATHS = ["/account", "/reports", "/interview", "/sign-in", "/sign-up"];
const CANONICAL_HOST = "www.sysgeeks.com";
const INTERNAL_UTM_SOURCE = "codex";

function shouldTrack(url: string): boolean {
  try {
    const { hostname, pathname, searchParams } = new URL(url, window.location.origin);
    if (hostname !== CANONICAL_HOST) return false;
    if (searchParams.get("utm_source") === INTERNAL_UTM_SOURCE) return false;
    if (PRIVATE_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) return false;
    const isPrivateProject =
      pathname.startsWith("/projects/") &&
      !pathname.startsWith("/projects/examples/") &&
      pathname !== "/projects/examples";
    return !isPrivateProject;
  } catch {
    return false;
  }
}

export function SiteAnalytics() {
  return (
    <>
      <Analytics beforeSend={(event) => (shouldTrack(event.url) ? event : null)} />
      <SpeedInsights beforeSend={(event) => (shouldTrack(event.url) ? event : null)} />
    </>
  );
}
