"use client";

import { useSyncExternalStore } from "react";

function subscribe(listener: () => void) {
  window.addEventListener("hashchange", listener);
  return () => window.removeEventListener("hashchange", listener);
}

/** The URL's #fragment without the #, kept in sync as it changes. Empty on the server. */
export function useHash(): string {
  return useSyncExternalStore(
    subscribe,
    () => window.location.hash.replace(/^#/, ""),
    () => "",
  );
}

/** Moves to a #fragment without scrolling, and tells every useHash reader. */
export function setHash(hash: string) {
  if (window.location.hash.replace(/^#/, "") === hash) return;
  history.replaceState(null, "", `#${hash}`);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}
