import type { ExampleProjectInput } from "@/lib/domain/content";

export const storefront: ExampleProjectInput = {
  id: "storefront",
  name: "Online store (example)",
  category: "commerce",
  summary:
    "A store with a product catalog, cart, checkout, inventory and fulfilment. Postgres holds stock and orders, Redis holds carts, and an outbox relay publishes orders to SQS for fulfilment. Replace any part with how your own system works.",
  scale: "50k orders/day, 20x spikes on sale days.",
  focusConceptIds: [
    "concurrency-control",
    "idempotency",
    "transactional-outbox",
    "caching",
    "state-machines",
    "delivery-guarantees",
  ],
  relatedInvestigationIds: ["payment-workflow", "distributed-cache"],
  components: [
    {
      id: "web",
      label: "Storefront",
      kind: "client",
      responsibility: "Product, cart and checkout pages in the browser.",
    },
    { id: "cdn", label: "CDN", kind: "edge", responsibility: "Caches product pages and images." },
    {
      id: "api",
      label: "Store API",
      kind: "service",
      responsibility: "Catalog, cart and checkout endpoints.",
    },
    {
      id: "postgres",
      label: "Postgres",
      kind: "database",
      responsibility: "Holds products, stock, orders and the outbox, and reserves stock inside the order transaction.",
      durableState: "products, inventory, orders, outbox",
    },
    {
      id: "redis",
      label: "Redis",
      kind: "cache",
      responsibility: "Holds shopping carts and caches product data.",
      durableState: "carts (7-day TTL); product cache",
    },
    {
      id: "payments",
      label: "Payment provider",
      kind: "external",
      responsibility: "Authorises and captures card payments.",
    },
    {
      id: "search",
      label: "Hosted search",
      kind: "external",
      responsibility: "Indexes products and answers search queries.",
    },
    {
      id: "orders",
      label: "Order queue",
      kind: "queue",
      responsibility: "SQS queue holding order placed events until fulfilment reads them.",
      durableState: "order events",
    },
    {
      id: "relay",
      label: "Outbox relay",
      kind: "worker",
      responsibility: "Publishes outbox rows to the order queue.",
    },
    {
      id: "fulfilment",
      label: "Fulfilment worker",
      kind: "worker",
      responsibility: "Sends orders to the warehouse and emails receipts.",
    },
    {
      id: "warehouse",
      label: "Warehouse 3PL",
      kind: "external",
      responsibility: "Creates shipments from fulfilment orders.",
    },
    { id: "email", label: "Email provider", kind: "external", responsibility: "Delivers receipt emails to customers." },
  ],
  flows: [
    { id: "page", from: "web", to: "cdn", label: "View product", kind: "request" },
    { id: "origin", from: "cdn", to: "api", label: "Render on miss", kind: "request" },
    { id: "cart", from: "web", to: "api", label: "Add to cart", kind: "request" },
    { id: "cart-store", from: "api", to: "redis", label: "Read/write cart", kind: "request" },
    { id: "order", from: "web", to: "api", label: "Place order", kind: "request" },
    { id: "stock", from: "api", to: "postgres", label: "Reserve stock and create order", kind: "request" },
    { id: "authorize", from: "api", to: "payments", label: "Authorize payment", kind: "request" },
    { id: "payment-events", from: "payments", to: "api", label: "Payment webhooks", kind: "async" },
    { id: "poll-outbox", from: "relay", to: "postgres", label: "Read outbox", kind: "request" },
    { id: "publish", from: "relay", to: "orders", label: "Publish order placed", kind: "async" },
    { id: "consume", from: "fulfilment", to: "orders", label: "Receive orders", kind: "request" },
    { id: "ship", from: "fulfilment", to: "warehouse", label: "Create shipment", kind: "request" },
    { id: "receipt", from: "fulfilment", to: "email", label: "Send receipt", kind: "request" },
    { id: "find", from: "web", to: "search", label: "Search", kind: "request" },
  ],
  invariants: [
    {
      id: "no-oversell",
      statement: "Stock never goes below zero",
      enforcedBy: ["api", "postgres"],
      mechanism:
        "UPDATE inventory SET available = available - $qty WHERE sku = $1 AND available >= $qty inside the order transaction; zero rows means out of stock.",
    },
    {
      id: "charge-once",
      statement: "An order is charged at most once",
      enforcedBy: ["api", "payments"],
      mechanism:
        "Order row created in 'pending' first; the payment call uses idempotency key = order id.",
    },
    {
      id: "event-published",
      statement: "Every committed order reaches fulfilment",
      enforcedBy: ["postgres", "relay"],
      mechanism:
        "Outbox row written in the order transaction; the relay retries until SQS accepts; fulfilment dedupes by order id.",
    },
  ],
};
