/**
 * @deprecated Accounts and credits are gone; AI runs on the learner's own key (see lib/store/ai-key-store.ts).
 * `data` is always null, so callers written for credits see no balance and no shortfall. Kept only so
 * components/playground/playground-ai.tsx compiles unchanged; delete with that import.
 */
export type Account = { signedIn: false } | { signedIn: true; balance: number };

const NO_ACCOUNT: { data: Account | null; loading: boolean; refresh: () => void } = {
  data: null,
  loading: false,
  refresh: () => {},
};

export function useAccount() {
  return NO_ACCOUNT;
}
