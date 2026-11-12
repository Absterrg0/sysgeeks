import type { ReactNode } from "react";

/**
 * @deprecated There are no credits, so there is never a shortfall: renders nothing.
 * Kept only so components/playground/playground-ai.tsx compiles unchanged; delete with that import.
 */
export const InsufficientCredits: (props: {
  feature: ReactNode;
  cost: number;
  balance: number;
  onDismiss: () => void;
  children?: ReactNode;
}) => null = () => null;
