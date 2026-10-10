import "server-only";
import {
  FLAG_REFUNDS_PER_30_DAYS,
  STALE_RUN_MINUTES,
  WELCOME_CREDITS,
  type AiFeature,
} from "@/lib/domain/pricing";
import { lockUserStep, type Db } from "@/lib/server/db";

export type RunStatus = "running" | "succeeded" | "failed";

export interface RunUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface AccountSummary {
  balance: number;
  hasPurchased: boolean;
  dodoCustomerId: string | null;
}

export interface LedgerEntry {
  id: string;
  delta: number;
  kind: string;
  ref: string;
  note: string | null;
  createdAt: Date;
}

export interface RunSummary {
  id: string;
  feature: AiFeature;
  status: RunStatus;
  credits: number;
  refunded: boolean;
  projectId: string | null;
  title: string | null;
  modelHash: string | null;
  inputSummary: unknown;
  errorCode: string | null;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
  flagged: boolean;
  flagReason: string | null;
  createdAt: Date;
  finishedAt: Date | null;
}

export interface RunDetail extends RunSummary {
  output: unknown;
}

export type FlagRejection = "not-found" | "already-flagged" | "limit" | "not-eligible";

const RUN_SUMMARY_COLUMNS = `
  id::text as id, feature, status, credits, refunded, project_id as "projectId", title,
  model_hash as "modelHash", input_summary as "inputSummary", error_code as "errorCode", model,
  input_tokens as "inputTokens", output_tokens as "outputTokens", cost_usd::float8 as "costUsd",
  flagged_at is not null as flagged, flag_reason as "flagReason", created_at as "createdAt",
  finished_at as "finishedAt"`;

export async function ensureAccount(db: Db, userId: string, opts: { verifiedEmail: boolean }): Promise<void> {
  await db.query("insert into accounts (user_id) values ($1::text) on conflict (user_id) do nothing", [userId]);
  if (!opts.verifiedEmail) return;
  await db.query(
    `with welcome as (
       insert into ledger (user_id, delta, kind, ref) values ($1::text, $2::int, 'welcome', $1::text)
       on conflict (kind, ref) do nothing returning user_id, delta
     )
     update accounts set balance = accounts.balance + welcome.delta
     from welcome where accounts.user_id = welcome.user_id`,
    [userId, WELCOME_CREDITS],
  );
}

export async function getAccountSummary(db: Db, userId: string): Promise<AccountSummary> {
  const [row] = await db.query<AccountSummary>(
    `select balance, has_purchased as "hasPurchased", dodo_customer_id as "dodoCustomerId"
     from accounts where user_id = $1::text`,
    [userId],
  );
  return row ?? { balance: 0, hasPurchased: false, dodoCustomerId: null };
}

export async function reserveRun(
  db: Db,
  input: {
    userId: string;
    runId: string;
    feature: AiFeature;
    credits: number;
    projectId?: string;
    title?: string;
    modelHash?: string;
    inputSummary?: unknown;
    estCostUsd?: number;
    maxRunning?: number;
    dailyLimit?: number;
  },
): Promise<boolean> {
  const results = await db.transaction<{ reserved: number }>([
    lockUserStep(input.userId),
    {
      text: `with debit as (
         update accounts set balance = accounts.balance - $3::int
         where user_id = $1::text and balance >= $3::int
           and ($9::int is null or (select count(*) from ai_runs
             where user_id = $1::text and status = 'running') < $9::int)
           and ($10::int is null or (select count(*) from ai_runs
             where user_id = $1::text and feature = $4::text and created_at > now() - interval '1 day') < $10::int)
         returning user_id
       ), run as (
         insert into ai_runs (id, user_id, feature, status, credits, project_id, title, model_hash, input_summary, est_cost_usd)
         select $2::uuid, user_id, $4::text, 'running', $3::int, $5::text, $6::text, $7::text, $8::jsonb, $11::numeric
         from debit returning id
       ), entry as (
         insert into ledger (user_id, delta, kind, ref)
         select $1::text, -$3::int, 'run', id::text from run returning id
       )
       select count(*)::int as reserved from run`,
      params: [
        input.userId,
        input.runId,
        input.credits,
        input.feature,
        input.projectId ?? null,
        input.title ?? null,
        input.modelHash ?? null,
        input.inputSummary === undefined ? null : JSON.stringify(input.inputSummary),
        input.maxRunning ?? null,
        input.dailyLimit ?? null,
        input.estCostUsd ?? null,
      ],
    },
  ]);
  return (results[1]?.[0]?.reserved ?? 0) > 0;
}

export async function settleRun(
  db: Db,
  input: {
    runId: string;
    output: unknown;
    model: string;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    inputSummary?: unknown;
  },
): Promise<boolean> {
  const rows = await db.query<{ id: string }>(
    `update ai_runs set status = 'succeeded', output = $2::jsonb, model = $3::text,
       input_tokens = $4::int, output_tokens = $5::int, cost_usd = $6::numeric, finished_at = now(),
       input_summary = coalesce($7::jsonb, input_summary)
     where id = $1::uuid and status = 'running' returning id::text as id`,
    [
      input.runId,
      input.output === undefined ? null : JSON.stringify(input.output),
      input.model,
      input.inputTokens,
      input.outputTokens,
      input.costUsd,
      input.inputSummary === undefined ? null : JSON.stringify(input.inputSummary),
    ],
  );
  return rows.length > 0;
}

export async function failRun(
  db: Db,
  runId: string,
  errorCode: string,
  usage?: RunUsage,
): Promise<{ refunded: number }> {
  const [row] = await db.query<{ refunded: number }>(
    `with run as (
       update ai_runs set status = 'failed', error_code = $2::text, refunded = true, finished_at = now(),
         model = coalesce($3::text, model), input_tokens = coalesce($4::int, input_tokens),
         output_tokens = coalesce($5::int, output_tokens), cost_usd = coalesce($6::numeric, cost_usd)
       where id = $1::uuid and status = 'running' returning user_id, credits, id
     ), entry as (
       insert into ledger (user_id, delta, kind, ref)
       select user_id, credits, 'run-refund', id::text from run where credits > 0
       on conflict (kind, ref) do nothing returning user_id, delta
     ), acct as (
       update accounts set balance = accounts.balance + entry.delta
       from entry where accounts.user_id = entry.user_id returning accounts.user_id
     )
     select coalesce((select sum(delta) from entry), 0)::int as refunded`,
    [
      runId,
      errorCode,
      usage?.model ?? null,
      usage?.inputTokens ?? null,
      usage?.outputTokens ?? null,
      usage?.costUsd ?? null,
    ],
  );
  return { refunded: row?.refunded ?? 0 };
}

export async function flagRun(
  db: Db,
  input: { userId: string; runId: string; reason: string },
): Promise<{ ok: boolean; refunded: number; reason?: FlagRejection }> {
  const results = await db.transaction<{ refunded: number; flagged: number }>([
    lockUserStep(input.userId),
    {
      text: `with run as (
         update ai_runs set refunded = true, flagged_at = now(), flag_reason = $3::text
         where id = $2::uuid and user_id = $1::text and status = 'succeeded' and not refunded
           and flagged_at is null and feature in ('review', 'questions')
           and (select count(*) from ai_runs where user_id = $1::text and flagged_at > now() - interval '30 days') < $4::int
         returning user_id, credits, id
       ), entry as (
         insert into ledger (user_id, delta, kind, ref)
         select user_id, credits, 'run-refund', id::text from run where credits > 0
         on conflict (kind, ref) do nothing returning user_id, delta
       ), acct as (
         update accounts set balance = accounts.balance + entry.delta
         from entry where accounts.user_id = entry.user_id returning accounts.user_id
       )
       select coalesce((select sum(delta) from entry), 0)::int as refunded,
         (select count(*) from run)::int as flagged`,
      params: [input.userId, input.runId, input.reason, FLAG_REFUNDS_PER_30_DAYS],
    },
  ]);
  const row = results[1]?.[0];
  if (row && row.flagged > 0) return { ok: true, refunded: row.refunded };

  const [run] = await db.query<{ flagged: boolean; eligible: boolean }>(
    `select flagged_at is not null as flagged,
       status = 'succeeded' and not refunded and feature in ('review', 'questions') as eligible
     from ai_runs where id = $2::uuid and user_id = $1::text`,
    [input.userId, input.runId],
  );
  if (!run) return { ok: false, refunded: 0, reason: "not-found" };
  if (run.flagged) return { ok: false, refunded: 0, reason: "already-flagged" };
  if (!run.eligible) return { ok: false, refunded: 0, reason: "not-eligible" };
  return { ok: false, refunded: 0, reason: "limit" };
}

export async function refundStaleRuns(db: Db, userId: string): Promise<number> {
  const [row] = await db.query<{ swept: number }>(
    `with run as (
       update ai_runs set status = 'failed', error_code = 'timeout', refunded = true, finished_at = now()
       where user_id = $1::text and status = 'running'
         and created_at < now() - make_interval(mins => $2::int)
       returning user_id, credits, id
     ), entry as (
       insert into ledger (user_id, delta, kind, ref)
       select user_id, credits, 'run-refund', id::text from run where credits > 0
       on conflict (kind, ref) do nothing returning user_id, delta
     ), totals as (
       select user_id, sum(delta)::int as delta from entry group by user_id
     ), acct as (
       update accounts set balance = accounts.balance + totals.delta
       from totals where accounts.user_id = totals.user_id returning accounts.user_id
     )
     select (select count(*) from run)::int as swept`,
    [userId, STALE_RUN_MINUTES],
  );
  return row?.swept ?? 0;
}

export async function countRunsToday(db: Db, userId: string, feature: AiFeature): Promise<number> {
  const [row] = await db.query<{ n: number }>(
    `select count(*)::int as n from ai_runs
     where user_id = $1::text and feature = $2::text and created_at > now() - interval '1 day'`,
    [userId, feature],
  );
  return row?.n ?? 0;
}

export async function countRunning(db: Db, userId: string): Promise<number> {
  const [row] = await db.query<{ n: number }>(
    "select count(*)::int as n from ai_runs where user_id = $1::text and status = 'running'",
    [userId],
  );
  return row?.n ?? 0;
}

export async function spentTodayUsd(db: Db): Promise<number> {
  const [row] = await db.query<{ usd: number }>(
    `select coalesce(sum(coalesce(cost_usd, est_cost_usd, 0)), 0)::float8 as usd from ai_runs
     where created_at > now() - interval '1 day'`,
  );
  return row?.usd ?? 0;
}

export async function recordCheckout(
  db: Db,
  input: { sessionId: string; userId: string; packId: string },
): Promise<void> {
  await db.query(
    `insert into checkouts (session_id, user_id, pack_id) values ($1::text, $2::text, $3::text)
     on conflict (session_id) do nothing`,
    [input.sessionId, input.userId, input.packId],
  );
}

export interface CheckoutRecord {
  userId: string;
  packId: string;
}

export async function checkoutFor(db: Db, sessionId: string): Promise<CheckoutRecord | null> {
  const [row] = await db.query<CheckoutRecord>(
    `select user_id as "userId", pack_id as "packId" from checkouts where session_id = $1::text`,
    [sessionId],
  );
  return row ?? null;
}

export async function userForCheckout(db: Db, sessionId: string): Promise<string | null> {
  return (await checkoutFor(db, sessionId))?.userId ?? null;
}

export async function hasWelcome(db: Db, userId: string): Promise<boolean> {
  const [row] = await db.query<{ welcomed: boolean }>(
    "select exists(select 1 from ledger where kind = 'welcome' and ref = $1::text) as welcomed",
    [userId],
  );
  return row?.welcomed ?? false;
}

export async function grantPurchase(
  db: Db,
  input: {
    paymentId: string;
    userId: string;
    packId: string;
    credits: number;
    amount: number;
    currency: string;
    customerId: string | null;
  },
): Promise<{ granted: boolean }> {
  await db.query(
    `insert into accounts (user_id, dodo_customer_id, has_purchased) values ($1::text, $2::text, true)
     on conflict (user_id) do update set has_purchased = true,
       dodo_customer_id = coalesce(excluded.dodo_customer_id, accounts.dodo_customer_id)`,
    [input.userId, input.customerId],
  );
  const rows = await db.query<{ balance: number }>(
    `with p as (
       insert into payments (payment_id, user_id, pack_id, credits, amount, currency)
       values ($1::text, $2::text, $3::text, $4::int, $5::int, $6::text)
       on conflict (payment_id) do nothing returning user_id, credits, payment_id
     ), e as (
       insert into ledger (user_id, delta, kind, ref)
       select user_id, credits, 'purchase', payment_id from p returning user_id, delta
     )
     update accounts set balance = accounts.balance + e.delta
     from e where accounts.user_id = e.user_id returning accounts.balance`,
    [input.paymentId, input.userId, input.packId, input.credits, input.amount, input.currency],
  );
  return { granted: rows.length > 0 };
}

export async function clawbackRefund(
  db: Db,
  input: { refundId: string; paymentId: string; amount: number; isPartial: boolean },
): Promise<{ removed: number; found: boolean }> {
  const [row] = await db.query<{ removed: number; found: boolean }>(
    `with pay as (
       select payment_id, user_id, credits, amount, refunded_credits
       from payments where payment_id = $2::text
     ), due as (
       select payment_id, user_id, greatest(0, least(
         case when $4::boolean
           then floor(credits * $3::numeric / nullif(amount, 0))::int
           else credits - refunded_credits end,
         credits - refunded_credits
       )) as credits_due
       from pay
     ), bal as (
       select due.payment_id, due.user_id, due.credits_due,
         least(due.credits_due, accounts.balance) as removable
       from due join accounts on accounts.user_id = due.user_id
     ), entry as (
       insert into ledger (user_id, delta, kind, ref)
       select user_id, -removable, 'refund-clawback', $1::text from bal
       on conflict (kind, ref) do nothing returning user_id, delta
     ), pay_upd as (
       update payments set refunded_credits = payments.refunded_credits + bal.credits_due
       from bal where payments.payment_id = bal.payment_id and exists (select 1 from entry)
       returning payments.payment_id
     ), acct as (
       update accounts set balance = accounts.balance + entry.delta
       from entry where accounts.user_id = entry.user_id returning accounts.user_id
     )
     select coalesce(-(select sum(delta) from entry), 0)::int as removed,
        exists(select 1 from pay) as found`,
    [input.refundId, input.paymentId, input.amount, input.isPartial],
  );
  return { removed: row?.removed ?? 0, found: row?.found ?? false };
}

export async function listLedger(db: Db, userId: string, limit = 50): Promise<LedgerEntry[]> {
  return db.query<LedgerEntry>(
    `select id::text as id, delta, kind, ref, note, created_at as "createdAt"
     from ledger where user_id = $1::text order by created_at desc, id desc limit $2::int`,
    [userId, limit],
  );
}

export async function listRuns(
  db: Db,
  userId: string,
  opts: { projectId?: string; feature?: AiFeature; limit?: number } = {},
): Promise<RunSummary[]> {
  return db.query<RunSummary>(
    `select ${RUN_SUMMARY_COLUMNS} from ai_runs
     where user_id = $1::text
       and ($2::text is null or project_id = $2::text)
       and ($3::text is null or feature = $3::text)
     order by created_at desc, id desc limit $4::int`,
    [userId, opts.projectId ?? null, opts.feature ?? null, opts.limit ?? 50],
  );
}

export async function getRun(db: Db, userId: string, runId: string): Promise<RunDetail | null> {
  const [row] = await db.query<RunDetail>(
    `select ${RUN_SUMMARY_COLUMNS}, output from ai_runs where id = $2::uuid and user_id = $1::text`,
    [userId, runId],
  );
  return row ?? null;
}

export async function deleteRunData(db: Db, userId: string, runId: string): Promise<boolean> {
  const rows = await db.query<{ id: string }>(
    `update ai_runs set output = null, input_summary = null
     where id = $2::uuid and user_id = $1::text returning id::text as id`,
    [userId, runId],
  );
  return rows.length > 0;
}
