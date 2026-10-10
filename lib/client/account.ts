import { useCallback, useEffect, useState } from "react";
import type { Features } from "@/lib/config";

export type AccountPack = { id: string; credits: number; priceUsd: number };

export type Account =
  | { signedIn: false; features: Features }
  | {
      signedIn: true;
      features: Features;
      balance: number;
      hasPurchased: boolean;
      quotas: { grade: { used: number; limit: number } };
      costs: { intakeText: number; intakeRepo: number; review: number; questions: number; grade: number };
      packs: readonly AccountPack[];
    };

/** The signed-in account, read from `/api/account`. A failed refresh keeps the last good data. */
export function useAccount() {
  const [data, setData] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [round, setRound] = useState(0);

  useEffect(() => {
    let stale = false;
    fetch("/api/account", { cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<Account>) : null))
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
  }, [round]);

  const refresh = useCallback(() => {
    setLoading(true);
    setRound((n) => n + 1);
  }, []);

  return { data, loading, refresh };
}
