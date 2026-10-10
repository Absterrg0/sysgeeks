"use client";

import { CreditsChip } from "@/components/billing-ui";
import { useAccount } from "@/lib/client/account";

/** The header's live credit balance. Renders nothing until the account is known to be signed in. */
export function LiveCredits() {
  const { data } = useAccount();
  if (!data?.signedIn) return null;
  return <CreditsChip balance={data.balance} />;
}
