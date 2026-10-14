"use client";

import Link from "next/link";
import { trackAuthStarted } from "@/lib/analytics";
import { useRef, useState } from "react";
import { useAccount } from "@/lib/client/account";
import { creditCost, DAILY_LIMITS, type PACKS } from "@/lib/domain/pricing";

type Pack = (typeof PACKS)[number];

/** What credits pay for, read from creditCost so the confirm step never disagrees with the buttons. */
const BUYS = [
  { action: "Architecture review of your system", cost: creditCost("review") },
  { action: "Tailored question set, 8 to 12 questions", cost: creditCost("questions") },
  { action: "Draft from a public GitHub repository", cost: creditCost("intake", { source: "repository" }) },
  { action: "Draft from a description or README", cost: creditCost("intake", { source: "readme" }) },
];

async function startCheckout(packId: string): Promise<string | null> {
  const res = await fetch("/api/billing/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ packId }),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { checkoutUrl?: string };
  return body.checkoutUrl ?? null;
}

/**
 * Buying a pack. The button opens a confirm step that says what the pack pays for before anything is charged;
 * checkout starts from there, or the step says why it cannot yet (signed out, purchases not open).
 */
export function BuyButton({ pack, name, featured }: { pack: Pack; name: string; featured: boolean }) {
  const { data } = useAccount();
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function buy() {
    setPending(true);
    setFailed(false);
    const checkoutUrl = await startCheckout(pack.id).catch(() => null);
    if (checkoutUrl) {
      window.location.assign(checkoutUrl);
      return;
    }
    setFailed(true);
    setPending(false);
  }

  const perCredit = (pack.priceUsd / pack.credits).toFixed(2);

  return (
    <>
      <button
        type="button"
        className={`btn ${featured ? "btn-accent" : "btn-secondary"} w-full justify-center`}
        disabled={!data}
        onClick={() => dialog.current?.showModal()}
      >
        Buy {pack.credits} credits
      </button>

      <dialog
        ref={dialog}
        aria-labelledby={`buy-${pack.id}`}
        className="dialog w-[min(30rem,calc(100vw-2rem))]"
        onClick={(e) => {
          // A click on the backdrop lands on the dialog itself.
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
      >
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id={`buy-${pack.id}`} className="text-[1.0625rem] font-semibold">
                {name} pack
              </h2>
              <p className="mt-1 text-[0.8125rem] text-ink-3">
                {pack.credits} credits, one-time · ${perCredit} each
              </p>
            </div>
            <p className="font-mono text-[1.75rem] leading-none tabular-nums">${pack.priceUsd}</p>
          </div>

          <p className="sheet-label mt-6 mb-1.5">What {pack.credits} credits pay for</p>
          <table className="w-full text-[0.8125rem]">
            <tbody>
              {BUYS.map((row) => (
                <tr key={row.action} className="border-t border-rule-soft">
                  <th scope="row" className="py-2 pr-3 text-left font-normal text-ink-2">
                    {row.action}
                  </th>
                  <td className="py-2 pr-3 text-right font-mono text-[0.75rem] whitespace-nowrap text-ink-3">
                    {row.cost} cr
                  </td>
                  <td className="py-2 text-right font-mono whitespace-nowrap text-accent tabular-nums">
                    ×{Math.floor(pack.credits / row.cost)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-[0.75rem] leading-relaxed text-ink-3">
            Or any mix of them. Feedback on written answers costs nothing: {DAILY_LIMITS.grade.purchaser} a day once
            you have bought a pack. Credits never expire, a failed run gives its credits back, and an unused pack is
            refundable for 14 days.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => dialog.current?.close()}>
              Not now
            </button>
            {!data?.features.billing ? (
              <button type="button" className="btn btn-accent" disabled>
                Purchases open soon
              </button>
            ) : !data.signedIn ? (
              <Link
                href="/sign-up?redirect_url=/%23pricing"
                className="btn btn-accent"
                onClick={() => trackAuthStarted("sign_up", "pricing")}
              >
                Sign up to buy
              </Link>
            ) : (
              <button type="button" className="btn btn-accent" disabled={pending} onClick={buy}>
                {pending ? "Opening checkout…" : `Pay $${pack.priceUsd}`}
              </button>
            )}
          </div>
          {failed && (
            <p role="alert" className="mt-3 text-right text-[0.8125rem] text-signal-gap">
              Could not start checkout. Try again in a moment.
            </p>
          )}
          <p className="mt-4 text-right text-[0.6875rem] text-ink-3">Payments by Dodo Payments.</p>
        </div>
      </dialog>
    </>
  );
}
