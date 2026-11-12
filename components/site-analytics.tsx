"use client";

import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { trackAuthCompleted, trackPageView } from "@/lib/analytics";

export function SiteAnalytics({ auth }: { auth: boolean }) {
  const pathname = usePathname();

  useEffect(() => {
    trackPageView(pathname);
  }, [pathname]);

  return auth ? <AuthCompletionTracker /> : null;
}

function AuthCompletionTracker() {
  const { isLoaded, isSignedIn } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoaded && isSignedIn) trackAuthCompleted();
  }, [isLoaded, isSignedIn, pathname]);

  return null;
}
