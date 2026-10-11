"use client";

import { track as trackVercel } from "@vercel/analytics";
import type { PostHog } from "posthog-js";

const PRIVATE_PATHS = ["/account", "/reports", "/interview", "/sign-in", "/sign-up"];
const CANONICAL_HOST = "www.sysgeeks.com";
const INTERNAL_UTM_VALUES = new Set(["codex", "posthog-setup"]);
const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

type EventProperties = Record<string, string | number | boolean | null>;

let posthogPromise: Promise<PostHog> | undefined;

export function shouldTrack(url: string): boolean {
  try {
    const { hostname, pathname, searchParams } = new URL(url, window.location.origin);
    if (hostname !== CANONICAL_HOST) return false;
    if ([searchParams.get("utm_source"), searchParams.get("utm_medium")].some((value) =>
      value !== null && INTERNAL_UTM_VALUES.has(value.toLowerCase()),
    )) return false;
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

function getPostHog(): Promise<PostHog> | undefined {
  if (!POSTHOG_KEY) return undefined;

  posthogPromise ??= import("posthog-js").then(({ default: posthog }) => {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      defaults: "2026-05-30",
      autocapture: false,
      rageclick: false,
      capture_pageview: false,
      capture_pageleave: false,
      disable_session_recording: true,
      persistence: "sessionStorage",
      person_profiles: "identified_only",
    });
    return posthog;
  });

  return posthogPromise;
}

function sendToPostHog(event: string, properties?: EventProperties) {
  const client = getPostHog();
  if (!client) return;

  void client.then((posthog) => posthog.capture(event, properties));
}

export function track(event: string, properties?: EventProperties) {
  if (typeof window === "undefined" || !shouldTrack(window.location.href)) return;

  trackVercel(event, properties);
  sendToPostHog(event, properties);
}

export function trackPageView(pathname: string) {
  if (typeof window === "undefined" || !shouldTrack(window.location.href)) return;

  const current = new URL(window.location.href);
  const page = new URL(pathname, current.origin);
  for (const key of ["utm_source", "utm_medium", "utm_campaign"]) {
    const value = current.searchParams.get(key);
    if (value) page.searchParams.set(key, value.slice(0, 128));
  }

  sendToPostHog("$pageview", { $current_url: page.toString() });
}
