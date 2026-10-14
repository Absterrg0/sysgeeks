"use client";

import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { shouldTrack, trackAuthCompleted, trackPageView } from "@/lib/analytics";

export function SiteAnalytics({ auth }: { auth: boolean }) {
  const pathname = usePathname();

  useEffect(() => {
    trackPageView(pathname);
  }, [pathname]);

  return (
    <>
      {auth ? <AuthCompletionTracker /> : null}
      <Analytics beforeSend={(event) => (shouldTrack(event.url) ? event : null)} />
      <SpeedInsights beforeSend={(event) => (shouldTrack(event.url) ? event : null)} />
    </>
  );
}

function AuthCompletionTracker() {
  const { isLoaded, isSignedIn } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoaded && isSignedIn) trackAuthCompleted();
  }, [isLoaded, isSignedIn, pathname]);

  return null;
}
