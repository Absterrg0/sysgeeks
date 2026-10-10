"use client";

import Link from "next/link";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { creditCost } from "@/lib/domain/pricing";

function creditsLabel(n: number): string {
  return `${n} ${n === 1 ? "credit" : "credits"}`;
}

/** What an action costs, shown inside its button before the click. Free actions never show one. */
export function CostTag({ credits }: { credits: number }) {
  return <span className="cost">{creditsLabel(credits)}</span>;
}

const COST_ROWS = [
  { label: "Draft from a README or description", credits: creditCost("intake", { source: "readme" }) },
  { label: "Draft from a public repository", credits: creditCost("intake", { source: "repository" }) },
  { label: "Architecture review", credits: creditCost("review") },
  { label: "Tailored question set", credits: creditCost("questions") },
  { label: "AI interviewer, per session", credits: creditCost("interview") },
];

/**
 * The credit balance in the header. Turns amber when running low. The popover lists real costs.
 * Packs never expire in the MVP, so `renewsAt` is optional and only shown when given.
 */
export function CreditsChip({
  balance,
  allotment,
  renewsAt,
  usageHref = "/account",
}: {
  balance: number;
  /** The reference total the meter is drawn against. Omit it (packs have none) to show the balance only. */
  allotment?: number;
  renewsAt?: Date | null;
  usageHref?: string;
}) {
  const id = useId();
  const low = balance <= 3 || (allotment !== undefined && balance <= allotment * 0.1);
  const fill = allotment !== undefined && allotment > 0 ? Math.min(100, (balance / allotment) * 100) : null;
  return (
    <>
      <button
        type="button"
        popoverTarget={id}
        className="credits"
        data-low={low}
        aria-label={low ? `${creditsLabel(balance)} left, running low` : creditsLabel(balance)}
      >
        {fill !== null && (
          <span className="credits-meter" aria-hidden="true">
            <span style={{ width: `${fill}%` }} />
          </span>
        )}
        <span className="credits-count" aria-hidden="true">
          {balance}
        </span>
        <span className="hidden sm:inline" aria-hidden="true">
          credits
        </span>
      </button>
      <div id={id} popover="auto" className="stage-popover panel w-72 p-4">
        <p className="kicker">Balance</p>
        <p className="mt-1 font-display text-h1 tabular-nums">{balance}</p>
        <p className="text-small text-ink-3">
          {creditsLabel(balance)} left
          {renewsAt && ` · renews ${renewsAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`}
        </p>
        <p className="kicker mt-4">What things cost</p>
        <dl className="mt-2 grid gap-1.5 text-small">
          {COST_ROWS.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-3">
              <dt className="text-ink-2">{row.label}</dt>
              <dd className="shrink-0 font-mono tabular-nums">{creditsLabel(row.credits)}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 flex items-center justify-between gap-3">
          <Link href="/#pricing" className="btn btn-primary btn-sm">
            {balance === 0 ? "Top up" : "Buy credits"}
          </Link>
          <Link href={usageHref} className="link text-small">
            Usage history
          </Link>
        </div>
      </div>
    </>
  );
}

export type PaywallProps = {
  /** What the feature does, e.g. "Architecture review". */
  feature: ReactNode;
  /** Credits for one run. */
  cost: number;
  balance: number;
  onUse: () => void;
  onDismiss: () => void;
  /** One paragraph on what the user gets. */
  children?: ReactNode;
  plansHref?: string;
  className?: string;
};

/**
 * The inline paywall. With enough credits it offers to spend them; without, it offers plans.
 * "Not now" and the other secondary action are the same size as the primary one.
 */
export function PaywallPrompt({
  feature,
  cost,
  balance,
  onUse,
  onDismiss,
  children,
  plansHref = "/#pricing",
  className = "",
}: PaywallProps) {
  const enough = balance >= cost;
  return (
    <div className={`paywall ${className}`}>
      <p className="kicker">{enough ? "Pro feature" : "Out of credits"}</p>
      <h3 className="mt-2 font-heading text-h3">{feature}</h3>
      {children && <p className="mt-2 text-pretty text-ui text-ink-2">{children}</p>}
      <table className="data-table mt-4">
        <tbody>
          <tr>
            <th scope="row">This costs</th>
            <td className="text-right font-mono tabular-nums">{creditsLabel(cost)}</td>
          </tr>
          <tr>
            <th scope="row">You have</th>
            <td className="text-right font-mono tabular-nums">{creditsLabel(balance)}</td>
          </tr>
        </tbody>
      </table>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {enough ? (
          <>
            <button type="button" className="btn btn-primary" onClick={onUse}>
              Use {creditsLabel(cost)}
            </button>
            <button type="button" className="btn btn-ghost" onClick={onDismiss}>
              Cancel
            </button>
          </>
        ) : (
          <>
            <Link href={plansHref} className="btn btn-primary">
              See plans
            </Link>
            <button type="button" className="btn btn-ghost" onClick={onDismiss}>
              Not now
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** The same paywall in a native modal. Only for a paid action the user just triggered. Esc and the backdrop close it. */
export function PaywallDialog({ open, ...prompt }: PaywallProps & { open: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={prompt.onDismiss}
      onClick={(event) => {
        if (event.target === event.currentTarget) prompt.onDismiss();
      }}
      className="m-auto w-[calc(100%_-_2rem)] max-w-[28rem] rounded-[14px] bg-raised p-0 [box-shadow:var(--shadow-raised)] backdrop:bg-[color-mix(in_srgb,var(--ink)_35%,transparent)] backdrop:backdrop-blur-[2px]"
    >
      <PaywallPrompt {...prompt} className="rounded-none shadow-none" />
    </dialog>
  );
}

/** A plan or pack. Prices always carry their period and currency in `price` and `period`. */
export function PriceCard({
  plan,
  price,
  period,
  allotment,
  description,
  features,
  featured = false,
  band,
  cta,
}: {
  plan: ReactNode;
  /** e.g. "$12" */
  price: ReactNode;
  /** e.g. "one-time, USD" */
  period: ReactNode;
  /** e.g. "40 credits" */
  allotment: ReactNode;
  description: ReactNode;
  /** Only what is included. Missing features are not listed. */
  features: readonly ReactNode[];
  featured?: boolean;
  /** A label on the featured plan, e.g. "Recommended". */
  band?: ReactNode;
  cta: ReactNode;
}) {
  return (
    <article className={`price-card ${featured ? "price-card-featured" : ""}`}>
      <div>
        <div className="flex min-h-5 items-baseline justify-between gap-3">
          <h3 className="text-[0.9375rem] font-medium">{plan}</h3>
          {featured && band && <p className="price-card-band">{band}</p>}
        </div>
        <p className="pixel mt-6 text-[2.75rem] leading-none">{price}</p>
        <p className="mt-3 text-small text-ink-3">{period}</p>
      </div>
      <p className="font-mono text-code text-ink">{allotment}</p>
      <p className="text-ui text-pretty text-ink-2">{description}</p>
      <ul className="grid gap-2.5 border-t border-rule pt-5 text-[0.8125rem] leading-relaxed text-ink-2">
        {features.map((feature, i) => (
          <li key={i} className="flex gap-2.5">
            <span aria-hidden="true" className="mt-[0.5rem] size-[5px] shrink-0 rounded-[1px] bg-ink-3" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-2">{cta}</div>
    </article>
  );
}
