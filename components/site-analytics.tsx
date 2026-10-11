"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { shouldTrack, trackPageView } from "@/lib/analytics";

export function SiteAnalytics() {
  const pathname = usePathname();

  useEffect(() => {
    trackPageView(pathname);
  }, [pathname]);

  return (
    <>
      <Analytics beforeSend={(event) => (shouldTrack(event.url) ? event : null)} />
      <SpeedInsights beforeSend={(event) => (shouldTrack(event.url) ? event : null)} />
    </>
  );
}
