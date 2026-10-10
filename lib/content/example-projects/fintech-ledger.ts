import type { ExampleProjectInput } from "@/lib/domain/content";

export const fintechLedger: ExampleProjectInput = {
  id: "fintech-ledger",
  name: "Wallet and payments ledger (example)",
  category: "fintech",
  summary:
    "A mobile wallet with P2P transfers, card top-ups and bank payouts. Every movement posts to a double-entry ledger in Postgres; a transactional outbox feeds Kafka, merchant webhooks and a daily reconciliation against settlement files. Replace any part with how your own system works.",
  scale: "1.5M wallets; 80 transfers/s at peak; daily settlement files",
  focusConceptIds: [
    "transactions",
    "idempotency",
    "transactional-outbox",
    "reconciliation",
    "concurrency-control",
    "event-log",
    "webhooks",
    "delivery-guarantees",
  ],
  relatedInvestigationIds: ["payment-workflow"],
  components: [
    {
      id: "app",
      label: "Mobile wallet",
      kind: "client",
      responsibility: "Wallet screens for sending money, topping up and withdrawing to a bank account.",
    },
    {
      id: "api",
      label: "Payments API",
      kind: "service",
      responsibility: "Authenticates requests, enforces idempotency keys and orchestrates each money movement.",
    },
    {
      id: "risk",
      label: "Risk service",
      kind: "service",
      responsibility: "Scores transfers and top-ups for fraud before any money moves.",
    },
    {
      id: "ledger",
      label: "Ledger service",
      kind: "service",
      responsibility: "Posts balanced double-entry journal transactions.",
    },
    {
      id: "ledger-db",
      label: "Postgres",
      kind: "database",
      responsibility: "Holds accounts, the journal, balances, idempotency keys and the outbox.",
      durableState: "accounts, journal entries (append-only), balances, idempotency keys, outbox",
    },
    {
      id: "processor",
      label: "Card processor",
      kind: "external",
      responsibility: "Charges cards for top-ups and sends payment events.",
    },
    {
      id: "bank",
      label: "Bank partner",
      kind: "external",
      responsibility: "Executes bank payouts and produces settlement files.",
    },
    {
      id: "relay",
      label: "Outbox relay",
      kind: "worker",
      responsibility: "Reads unpublished outbox rows and publishes them to Kafka.",
    },
    {
      id: "events",
      label: "Kafka",
      kind: "stream",
      responsibility: "Carries journal events to consumers.",
      durableState: "journal events",
    },
    {
      id: "webhooks",
      label: "Webhook worker",
      kind: "worker",
      responsibility: "Consumes journal events and delivers merchant webhooks.",
    },
    {
      id: "merchants",
      label: "Merchant endpoints",
      kind: "external",
      responsibility: "Receive webhook deliveries from the platform.",
    },
    {
      id: "recon",
      label: "Reconciliation job",
      kind: "worker",
      responsibility: "Matches settlement lines to journal entries each day.",
    },
    {
      id: "settlement",
      label: "Settlement files",
      kind: "object-store",
      responsibility: "Stores the daily settlement files from the processor and bank.",
      durableState: "processor and bank settlement files",
    },
  ],
  flows: [
    { id: "transfer", from: "app", to: "api", label: "Send money", kind: "request" },
    { id: "check", from: "api", to: "risk", label: "Risk check", kind: "request" },
    { id: "post", from: "api", to: "ledger", label: "Post entries", kind: "request" },
    { id: "journal", from: "ledger", to: "ledger-db", label: "Write journal", kind: "request" },
    { id: "topup", from: "api", to: "processor", label: "Charge card", kind: "request" },
    { id: "processor-events", from: "processor", to: "api", label: "Processor webhooks", kind: "async" },
    { id: "payout", from: "api", to: "bank", label: "Send payout", kind: "request" },
    { id: "outbox", from: "relay", to: "ledger-db", label: "Read outbox", kind: "request" },
    { id: "publish", from: "relay", to: "events", label: "Publish entries", kind: "async" },
    { id: "consume", from: "webhooks", to: "events", label: "Consume events", kind: "request" },
    { id: "deliver", from: "webhooks", to: "merchants", label: "Deliver webhooks", kind: "async" },
    { id: "files", from: "recon", to: "settlement", label: "Read settlement files", kind: "data" },
    { id: "compare", from: "recon", to: "ledger-db", label: "Compare with journal", kind: "request" },
  ],
  invariants: [
    {
      id: "entries-balance",
      statement: "Every journal transaction sums to zero",
      enforcedBy: ["ledger", "ledger-db"],
      mechanism:
        "Posting function inserts all legs and checks SUM(amount) = 0 before commit; a deferred constraint trigger rejects unbalanced transactions.",
    },
    {
      id: "no-overdraft",
      statement: "A wallet balance never goes negative",
      enforcedBy: ["ledger", "ledger-db"],
      mechanism: "SELECT … FOR UPDATE on the account row, check, then post in the same transaction.",
    },
    {
      id: "idempotent-transfer",
      statement: "A retried transfer posts once",
      enforcedBy: ["api", "ledger-db"],
      mechanism:
        "Idempotency-Key stored with request hash and response in the posting transaction; a replay returns the stored response; a different body with the same key is rejected.",
    },
    {
      id: "books-match",
      statement: "Ledger matches settlement files daily",
      enforcedBy: ["recon", "ledger-db"],
      mechanism:
        "Unique constraint on journal_entries(external_ref) makes each settlement line match at most one entry; the daily job writes mismatches to an exceptions queue for operations.",
    },
  ],
};
