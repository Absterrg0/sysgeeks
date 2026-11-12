/**
 * @deprecated SysGeeks sells nothing: AI runs on the learner's own key, so every action costs 0 credits here.
 * Kept only so components/playground/playground-ai.tsx compiles unchanged; delete with that import.
 */
export const creditCost: (feature: string, options?: unknown) => number = () => 0;
