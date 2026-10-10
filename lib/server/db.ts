import "server-only";
import { neon } from "@neondatabase/serverless";

export interface SqlStep {
  text: string;
  params?: unknown[];
}

export interface Db {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  /** Runs the steps in order in one transaction; returns each step's rows. */
  transaction<T = Record<string, unknown>>(steps: SqlStep[]): Promise<T[][]>;
}

export function neonDb(url: string): Db {
  const sql = neon(url);
  return {
    query: async <T = Record<string, unknown>>(text: string, params?: unknown[]) =>
      (await sql.query(text, params)) as unknown as T[],
    transaction: async <T = Record<string, unknown>>(steps: SqlStep[]) =>
      (await sql.transaction(steps.map((step) => sql.query(step.text, step.params)))) as unknown as T[][],
  };
}

/** Takes a per-user transaction-scoped advisory lock. Use as the first step of a transaction. */
export function lockUserStep(userId: string): SqlStep {
  return {
    text: "select pg_advisory_xact_lock(hashtextextended('acct:' || $1::text, 0))",
    params: [userId],
  };
}

let cached: Db | null | undefined;

export function getDb(): Db | null {
  if (cached === undefined) {
    const url = process.env.DATABASE_URL;
    cached = url ? neonDb(url) : null;
  }
  return cached;
}
