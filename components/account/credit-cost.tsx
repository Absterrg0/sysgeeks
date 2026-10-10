import { CostTag } from "@/components/billing-ui";

/** "2 credits · you have 7". Pass `balance` only once it is known. */
export function CreditCost({ credits, balance }: { credits: number; balance?: number }) {
  if (credits === 0) return <span className="text-small text-ink-3">Free</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 text-small text-ink-2">
      <CostTag credits={credits} />
      {balance !== undefined && <span className="text-ink-3">· you have {balance}</span>}
    </span>
  );
}
