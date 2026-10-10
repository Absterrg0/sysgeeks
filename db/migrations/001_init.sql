create table if not exists accounts (
  user_id text primary key,
  balance integer not null default 0 check (balance >= 0),
  dodo_customer_id text,
  has_purchased boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists ledger (
  id bigserial primary key,
  user_id text not null references accounts(user_id) on delete cascade,
  delta integer not null,
  kind text not null check (kind in ('welcome','purchase','run','run-refund','refund-clawback','adjustment')),
  ref text not null,
  note text,
  created_at timestamptz not null default now(),
  unique (kind, ref)
);
create index if not exists ledger_user_idx on ledger (user_id, created_at desc);
create table if not exists ai_runs (
  id uuid primary key,
  user_id text not null references accounts(user_id) on delete cascade,
  feature text not null check (feature in ('intake','review','questions','grade','interview')),
  status text not null check (status in ('running','succeeded','failed')),
  credits integer not null check (credits >= 0),
  refunded boolean not null default false,
  project_id text,
  title text,
  model_hash text,
  input_summary jsonb,
  output jsonb,
  error_code text,
  model text,
  input_tokens integer,
  output_tokens integer,
  cost_usd numeric(10,5),
  flagged_at timestamptz,
  flag_reason text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists ai_runs_user_idx on ai_runs (user_id, created_at desc);
create index if not exists ai_runs_feature_idx on ai_runs (user_id, feature, created_at desc);
create index if not exists ai_runs_day_idx on ai_runs (created_at);
create table if not exists checkouts (
  session_id text primary key,
  user_id text not null,
  pack_id text not null,
  created_at timestamptz not null default now()
);
create table if not exists payments (
  payment_id text primary key,
  user_id text not null references accounts(user_id) on delete cascade,
  pack_id text not null,
  credits integer not null,
  amount integer not null,
  currency text not null,
  refunded_credits integer not null default 0,
  created_at timestamptz not null default now()
);
