"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

const SKELETON_WIDTHS = [100, 92, 64];

/** A placeholder for content whose shape is known. Hidden from assistive tech: pair it with a status row. */
export function Skeleton({ lines, className = "" }: { lines?: number; className?: string }) {
  if (!lines) return <div aria-hidden="true" className={`skeleton ${className}`} />;
  return (
    <div aria-hidden="true" className={className}>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="skeleton skeleton-text" style={{ width: `${SKELETON_WIDTHS[i % 3]}%` }} />
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  children,
  action,
  secondary,
}: {
  title: ReactNode;
  children: ReactNode;
  /** One primary action. */
  action?: ReactNode;
  /** At most one secondary action. */
  secondary?: ReactNode;
}) {
  return (
    <div className="empty dotgrid">
      <svg width="120" height="48" viewBox="0 0 120 48" fill="none" aria-hidden="true" className="text-ink-3">
        <g stroke="currentColor" strokeWidth="1" strokeDasharray="3 2.5">
          <rect x="0.5" y="14.5" width="30" height="19" rx="3" />
          <rect x="44.5" y="14.5" width="30" height="19" rx="3" />
          <rect x="88.5" y="14.5" width="30" height="19" rx="3" />
          <path d="M30.5 24h14M74.5 24h14" />
        </g>
      </svg>
      <h3 className="font-heading text-h3">{title}</h3>
      <p className="max-w-[42ch] text-pretty text-ui text-ink-2">{children}</p>
      {(action || secondary) && (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondary}
        </div>
      )}
    </div>
  );
}

export type CalloutTone = "failure" | "scale" | "change" | "note" | "ai";

/** A quiet, ruled note. The tone sets the rule and title colour; the title says what kind of note it is. */
export function Callout({ tone, title, children }: { tone: CalloutTone; title: ReactNode; children: ReactNode }) {
  return (
    <div className={`callout callout-${tone}`}>
      <p className="callout-title">{title}</p>
      <div className="mt-1 text-ui text-ink-2">{children}</div>
    </div>
  );
}

export type ToastTone = "neutral" | "success" | "error";

export type ToastOptions = {
  message: ReactNode;
  tone?: ToastTone;
  /** A link when `href` is set, otherwise a button. Toasts with an action stay until dismissed. */
  action?: { label: string; href?: string; onClick?: () => void };
};

export type ToastItem = ToastOptions & { id: number };

const TOAST_MS = 5000;
const TOAST_LED: Record<ToastTone, string> = {
  neutral: "led-idle",
  success: "led-strong",
  error: "led-gap",
};

let toastList: ToastItem[] = [];
let lastToastId = 0;
const toastListeners = new Set<() => void>();
const NO_TOASTS: ToastItem[] = [];

function setToastList(next: ToastItem[]) {
  toastList = next;
  toastListeners.forEach((listener) => listener());
}

function subscribeToasts(listener: () => void) {
  toastListeners.add(listener);
  return () => {
    toastListeners.delete(listener);
  };
}

function showToast(options: ToastOptions): number {
  lastToastId += 1;
  setToastList([...toastList, { ...options, id: lastToastId }]);
  return lastToastId;
}

function dismissToast(id: number) {
  setToastList(toastList.filter((toast) => toast.id !== id));
}

/** The toast store. Call `toast` from anywhere; mount one `<Toaster />` to show them. */
export function useToast() {
  const toasts = useSyncExternalStore(subscribeToasts, () => toastList, () => NO_TOASTS);
  return { toasts, toast: showToast, dismiss: dismissToast };
}

export function Toast({ toast }: { toast: ToastItem }) {
  const { id, message, tone = "neutral", action } = toast;
  const [held, setHeld] = useState(false);
  const remaining = useRef(TOAST_MS);
  const sticky = tone === "error" || action !== undefined;

  useEffect(() => {
    if (sticky || held) return;
    const started = Date.now();
    const timer = window.setTimeout(() => dismissToast(id), remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current -= Date.now() - started;
    };
  }, [id, sticky, held]);

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className="toast pointer-events-auto"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setHeld(false);
      }}
    >
      <span className={`led ${TOAST_LED[tone]} mt-[0.4375rem]`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p>{message}</p>
        {action && (
          <p className="mt-1">
            {action.href ? (
              <Link href={action.href} className="link text-small">
                {action.label}
              </Link>
            ) : (
              <button type="button" className="link text-small" onClick={action.onClick}>
                {action.label}
              </button>
            )}
          </p>
        )}
      </div>
      <button type="button" className="knob -mr-1.5 -mt-1" aria-label="Dismiss" onClick={() => dismissToast(id)}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

/** Bottom-right on desktop, bottom-centre on mobile. Mount once, near the root. */
export function Toaster() {
  const { toasts } = useToast();
  return (
    <div className="pointer-events-none fixed inset-x-5 bottom-5 z-50 flex flex-col items-center gap-2 sm:items-end">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
