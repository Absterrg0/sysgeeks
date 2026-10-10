"use client";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const PRIVATE_PATHS = ["/account", "/reports", "/interview", "/sign-in", "/sign-up"];

function isPrivatePath(url: string): boolean {
  try {
    const { pathname } = new URL(url, window.location.origin);
    if (PRIVATE_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) return true;
    const isPrivateProject =
      pathname.startsWith("/projects/") &&
      !pathname.startsWith("/projects/examples/") &&
      pathname !== "/projects/examples";
    return isPrivateProject;
  } catch {
    return true;
  }
}

export function SiteAnalytics() {
  return (
    <>
      <Analytics beforeSend={(event) => (isPrivatePath(event.url) ? null : event)} />
      <SpeedInsights beforeSend={(event) => (isPrivatePath(event.url) ? null : event)} />
    </>
  );
}
