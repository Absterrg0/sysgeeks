"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { AccountUnavailable } from "@/components/account/account-unavailable";
import { Callout, Skeleton } from "@/components/feedback";
import { Section } from "@/components/page-header";
import type { Account } from "@/lib/client/account";

const POLL_MS = 2000;
const POLL_LIMIT_MS = 30_000;

type Status = Account & { payment?: { credited: boolean } };

/** Where checkout returns. Dodo appends `payment_id`. Credits arrive from a webhook, so this polls until they land. */
export default function BillingSuccessPage() {
  return (
    <Suspense fallback={null}>
      <BillingSuccess />
    </Suspense>
  );
}

function BillingSuccess() {
  const router = useRouter();
  const paymentId = useSearchParams().get("payment_id");
  const { data, loading, refresh } = useStatus(paymentId);
  const balance = data?.signedIn ? data.balance : null;
  const [baseline, setBaseline] = useState<number | null>(null);
  const [timedOut, setTimedOut] = useState(false);

  if (baseline === null && balance !== null) setBaseline(balance);
  const credited = paymentId
    ? data?.signedIn === true && data.payment?.credited === true
    : baseline !== null && balance !== null && balance > baseline;
  const polling = balance !== null && !credited && !timedOut;

  useEffect(() => {
    if (!polling) return;
    const tick = window.setInterval(refresh, POLL_MS);
    const limit = window.setTimeout(() => setTimedOut(true), POLL_LIMIT_MS);
    return () => {
      window.clearInterval(tick);
      window.clearTimeout(limit);
    };
  }, [polling, refresh]);

  const signInNeeded = data !== null && data.features.auth && data.features.db && !data.signedIn;
  useEffect(() => {
    if (signInNeeded) router.replace("/sign-in?redirect_url=/account");
  }, [signInNeeded, router]);

  if (data && !data.features.auth) return <AccountUnavailable reason="auth-off" />;
  if (data && !data.features.db) return <AccountUnavailable reason="db-off" />;

  if (credited) {
    return (
      <Section id="status" title="Credits added">
        <Callout tone="note" title="Your credits are ready">
          <p>
            Your balance is now {balance} {balance === 1 ? "credit" : "credits"}.
          </p>
          <p className="mt-3 flex flex-wrap gap-4">
            <Link href="/account/runs" className="link">
              See usage
            </Link>
            <Link href="/projects" className="link">
              Back to projects
            </Link>
          </p>
        </Callout>
      </Section>
    );
  }

  if (timedOut || (!data && !loading)) {
    return (
      <Section id="status" title="Payment received">
        <p className="text-ui text-ink-2">Payment received; credits can take a minute. Refresh or contact support.</p>
        <button type="button" className="btn btn-secondary btn-sm mt-4" onClick={() => refresh()}>
          Refresh balance
        </button>
      </Section>
    );
  }

  return (
    <Section id="status" title="Payment received">
      <p role="status" className="text-ui text-ink-2">
        Confirming your payment…
      </p>
      <Skeleton lines={1} className="mt-4 max-w-xs" />
    </Section>
  );
}

/** `/api/account`, with `paymentId` when Dodo sent one. Same shape as `useAccount`, plus `payment.credited`. */
function useStatus(paymentId: string | null) {
  const [data, setData] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [round, setRound] = useState(0);

  useEffect(() => {
    let stale = false;
    const query = paymentId ? `?paymentId=${encodeURIComponent(paymentId)}` : "";
    fetch(`/api/account${query}`, { cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<Status>) : null))
      .catch(() => null)
      .then((next) => {
        if (next && !stale) setData(next);
      })
      .finally(() => {
        if (!stale) setLoading(false);
      });
    return () => {
      stale = true;
    };
  }, [paymentId, round]);

  const refresh = useCallback(() => {
    setLoading(true);
    setRound((n) => n + 1);
  }, []);

  return { data, loading, refresh };
}
