import Link from "next/link";
import { AccountUnavailable } from "@/components/account/account-unavailable";
import { Section } from "@/components/page-header";
import { features } from "@/lib/config";
import { WELCOME_CREDITS } from "@/lib/domain/pricing";
import { pageMetadata } from "@/lib/metadata";
import { openAccount } from "@/lib/server/account-scope";
import { getAccountSummary } from "@/lib/server/billing/ledger";

export const metadata = pageMetadata({
  title: "Overview",
  description: "Your credit balance and how to buy more.",
  path: "/account",
  noindex: true,
});

export default async function AccountOverviewPage() {
  const scope = await openAccount();
  if (typeof scope === "string") return <AccountUnavailable reason={scope} />;

  const { balance, hasPurchased, dodoCustomerId } = await getAccountSummary(scope.db, scope.userId);
  const showReceipts = Boolean(dodoCustomerId) && features().billing;

  return (
    <Section id="balance" title="Balance">
      <div className="panel p-6 sm:p-8">
        <p className="font-display text-[4rem] leading-none tabular-nums">{balance}</p>
        <p className="mt-2 text-small text-ink-2">{balance === 1 ? "credit" : "credits"} available</p>
        <p className="mt-6 max-w-[60ch] text-ui text-ink-2">
          {hasPurchased
            ? "You have bought credits before, so your daily limit on answer grading is the higher one."
            : `You have not bought credits yet. You started with ${WELCOME_CREDITS} free credits. Buying a pack raises your daily limit on answer grading.`}
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Link href="/#pricing" className="btn btn-primary btn-sm">
            Buy credits
          </Link>
          {showReceipts && (
            <a href="/api/billing/portal" className="btn btn-secondary btn-sm">
              Receipts and billing
            </a>
          )}
        </div>
      </div>
      <p className="mt-6 text-small text-ink-3">
        <Link href="/account/runs" className="link">
          See your credit history and AI runs
        </Link>
      </p>
    </Section>
  );
}
