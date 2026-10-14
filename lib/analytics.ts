"use client";

import { track as trackVercel } from "@vercel/analytics";
import type { PostHog } from "posthog-js";

const PRIVATE_PATHS = ["/account", "/reports", "/interview", "/sign-in", "/sign-up"];
const CANONICAL_HOST = "www.sysgeeks.com";
const INTERNAL_UTM_VALUES = new Set(["codex", "posthog-setup"]);
const INTERNAL_SESSION_KEY = "sysgeeks-internal-analytics";
const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";
const POSTHOG_QUEUE_KEY = "sysgeeks-posthog-pending-events";
const AUTH_INTENT_KEY = "sysgeeks-auth-intent";
const AUTH_INTENT_MAX_AGE_MS = 30 * 60 * 1_000;
const MAX_QUEUED_EVENTS = 50;

type EventProperties = Record<string, string | number | boolean | null>;
type QueuedEvent = { event: string; properties?: EventProperties };
type AuthIntent = { kind: "sign_in" | "sign_up"; sourcePath: string; placement: string; createdAt: number };

let posthogPromise: Promise<PostHog> | undefined;

function queuePostHogEvent(event: string, properties?: EventProperties): boolean {
  try {
    const stored = window.sessionStorage.getItem(POSTHOG_QUEUE_KEY);
    const queue: QueuedEvent[] = stored ? JSON.parse(stored) : [];
    queue.push({ event, properties });
    window.sessionStorage.setItem(POSTHOG_QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUED_EVENTS)));
    return true;
  } catch {
    return false;
  }
}

function flushQueuedPostHogEvents(posthog: PostHog) {
  let queue: unknown;
  try {
    queue = JSON.parse(window.sessionStorage.getItem(POSTHOG_QUEUE_KEY) ?? "[]");
    window.sessionStorage.removeItem(POSTHOG_QUEUE_KEY);
  } catch {
    return;
  }

  if (!Array.isArray(queue)) return;
  for (const item of queue) {
    if (
      item &&
      typeof item === "object" &&
      "event" in item &&
      typeof item.event === "string" &&
      (!item.properties || typeof item.properties === "object")
    ) {
      posthog.capture(item.event, item.properties as EventProperties | undefined);
    }
  }
}

export function shouldTrack(url: string): boolean {
  try {
    const { hostname, pathname, searchParams } = new URL(url, window.location.origin);
    if (hostname !== CANONICAL_HOST) return false;
    const isInternalUtm = [searchParams.get("utm_source"), searchParams.get("utm_medium")].some(
      (value) => value !== null && INTERNAL_UTM_VALUES.has(value.toLowerCase()),
    );
    try {
      if (isInternalUtm) {
        window.sessionStorage.setItem(INTERNAL_SESSION_KEY, "1");
        window.sessionStorage.removeItem(POSTHOG_QUEUE_KEY);
      } else if (window.sessionStorage.getItem(INTERNAL_SESSION_KEY) === "1") {
        return false;
      }
    } catch {
      // Storage can be unavailable in restricted browser contexts; preserve URL-level filtering.
    }
    if (isInternalUtm) return false;
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

  posthogPromise ??= new Promise((resolve, reject) => {
    const load = () => {
      void import("posthog-js")
        .then(({ default: posthog }) => {
          posthog.init(POSTHOG_KEY, {
            api_host: POSTHOG_HOST,
            defaults: "2026-05-30",
            autocapture: false,
            rageclick: false,
            capture_pageview: false,
            capture_pageleave: false,
            disable_session_recording: true,
            disable_surveys: true,
            persistence: "sessionStorage",
            person_profiles: "identified_only",
          });
          flushQueuedPostHogEvents(posthog);
          resolve(posthog);
        })
        .catch(reject);
    };

    const requestIdleCallback = (
      window as unknown as {
        requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      }
    ).requestIdleCallback;

    if (requestIdleCallback) {
      requestIdleCallback.call(window, load, { timeout: 2_000 });
    } else {
      window.setTimeout(load, 1_000);
    }
  });

  return posthogPromise;
}

function sendToPostHog(event: string, properties?: EventProperties) {
  if (!POSTHOG_KEY) return;

  const queued = queuePostHogEvent(event, properties);
  const client = getPostHog();
  if (!client) return;

  if (!queued) {
    void client.then((posthog) => posthog.capture(event, properties));
    return;
  }

  void client.then((posthog) => flushQueuedPostHogEvents(posthog));
}

export function track(event: string, properties?: EventProperties) {
  if (typeof window === "undefined" || !shouldTrack(window.location.href)) return;

  trackVercel(event, properties);
  sendToPostHog(event, properties);
}

export function trackAuthStarted(kind: AuthIntent["kind"], placement: string) {
  if (typeof window === "undefined" || !shouldTrack(window.location.href)) return;

  const sourcePath = window.location.pathname;
  try {
    const intent: AuthIntent = { kind, sourcePath, placement, createdAt: Date.now() };
    window.sessionStorage.setItem(AUTH_INTENT_KEY, JSON.stringify(intent));
  } catch {
    // Still record the start event when browser storage is unavailable.
  }

  track(`${kind}_started`, { source_path: sourcePath, placement });
}

export function trackAuthCompleted() {
  if (typeof window === "undefined" || !shouldTrack(window.location.href)) return;

  let intent: AuthIntent | undefined;
  try {
    const stored = window.sessionStorage.getItem(AUTH_INTENT_KEY);
    window.sessionStorage.removeItem(AUTH_INTENT_KEY);
    if (!stored) return;

    const parsed: unknown = JSON.parse(stored);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !("kind" in parsed) ||
      (parsed.kind !== "sign_in" && parsed.kind !== "sign_up") ||
      !("sourcePath" in parsed) ||
      typeof parsed.sourcePath !== "string" ||
      !("placement" in parsed) ||
      typeof parsed.placement !== "string" ||
      !("createdAt" in parsed) ||
      typeof parsed.createdAt !== "number" ||
      Date.now() - parsed.createdAt > AUTH_INTENT_MAX_AGE_MS
    ) {
      return;
    }
    intent = parsed as AuthIntent;
  } catch {
    return;
  }

  const event = `${intent.kind}_completed`;
  const properties = { source_path: intent.sourcePath, placement: intent.placement };
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
