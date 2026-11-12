/**
 * @deprecated AI no longer needs an account; it needs the learner's own API key. Kept only so
 * components/playground/playground-ai.tsx (being reworked on another branch) compiles unchanged.
 * Import `AiKeyGate` from "@/components/ai-key/ai-key-gate" instead, then delete this file.
 */
export { AiKeyGate as SignInGate } from "@/components/ai-key/ai-key-gate";
