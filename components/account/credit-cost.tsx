"use client";

import { AiModelTag } from "@/components/ai-key/ai-key-gate";

/**
 * @deprecated There are no credits: AI runs on the learner's own key. Shows the model the run will use instead.
 * Kept only so components/playground/playground-ai.tsx compiles unchanged; use `AiModelTag`, then delete this file.
 */
export const CreditCost: (props: { credits: number; balance?: number }) => React.JSX.Element = () => <AiModelTag />;
