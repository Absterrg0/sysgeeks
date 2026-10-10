"use client";

import type { ReactNode } from "react";
import { PaywallPrompt } from "@/components/billing-ui";

/** Inline panel for a paid action the balance can't cover. Renders nothing when the balance is enough. */
export function InsufficientCredits({
  feature,
  cost,
  balance,
  onDismiss,
  children,
}: {
  feature: ReactNode;
  cost: number;
  balance: number;
  onDismiss: () => void;
  children?: ReactNode;
}) {
  if (balance >= cost) return null;
  return (
    <PaywallPrompt feature={feature} cost={cost} balance={balance} onUse={onDismiss} onDismiss={onDismiss}>
      {children}
    </PaywallPrompt>
  );
}
