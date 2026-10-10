import type { ExampleProjectInput } from "@/lib/domain/content";

export const eventTicketing: ExampleProjectInput = {
  id: "event-ticketing",
  name: "Concert ticketing (example)",
  category: "ticketing",
  summary:
    "Concert ticket sales with seat maps, 10-minute seat holds during checkout, and a waiting room in front of the API for on-sale spikes. Postgres holds seat state, a queue feeds ticket issuing, and an object store keeps the ticket PDFs.",
  scale: "100k buyers in the first minute of an on-sale; 20k seats per show",
  focusConceptIds: [
    "concurrency-control",
    "leases-and-fencing",
    "load-shedding",
    "rate-limiting",
    "caching",
    "idempotency",
    "backpressure",
  ],
  relatedInvestigationIds: ["api-rate-limiter"],
  components: [
    {
      id: "buyer",
      label: "Buyer web and app",
      kind: "client",
      responsibility: "Event pages, seat picker and checkout on the web and in the mobile app.",
    },
    {
      id: "waiting-room",
      label: "Waiting room",
      kind: "edge",
      responsibility: "Admits buyers at a fixed rate and signs their admission tokens.",
    },
    { id: "cdn", label: "CDN", kind: "edge", responsibility: "Serves static assets and event pages." },
    {
      id: "api",
      label: "Ticketing API",
      kind: "service",
      responsibility: "Serves seat maps, places holds, starts payment and checks admission tokens.",
    },
    {
      id: "seatmap",
      label: "Seat availability cache",
      kind: "cache",
      responsibility: "Serves cached seat availability for map reads.",
      durableState: "none; rebuilt from inventory on a miss",
    },
    {
      id: "inventory",
      label: "Postgres",
      kind: "database",
      responsibility: "Holds seat status, holds and orders, changed only by conditional updates.",
      durableState: "seats, holds, orders",
    },
    {
      id: "payments",
      label: "Payment provider",
      kind: "external",
      responsibility: "Takes card payments and sends payment webhooks.",
    },
    {
      id: "orders",
      label: "Order queue",
      kind: "queue",
      responsibility: "Holds confirmed orders until the issuer picks them up.",
      durableState: "confirmed orders",
    },
    {
      id: "issuer",
      label: "Ticket issuer",
      kind: "worker",
      responsibility: "Issues tickets, stores them and emails them to buyers.",
    },
    {
      id: "tickets",
      label: "Ticket store",
      kind: "object-store",
      responsibility: "Holds ticket PDFs and wallet passes.",
      durableState: "ticket PDFs and passes",
    },
    { id: "email", label: "Email provider", kind: "external", responsibility: "Delivers ticket emails." },
    {
      id: "sweeper",
      label: "Hold sweeper",
      kind: "worker",
      responsibility: "Releases holds whose 10-minute timers have expired.",
    },
  ],
  flows: [
    { id: "enter", from: "buyer", to: "waiting-room", label: "Join queue", kind: "request" },
    { id: "assets", from: "buyer", to: "cdn", label: "Load event page", kind: "request" },
    { id: "map", from: "buyer", to: "api", label: "View seats", kind: "request" },
    { id: "cached", from: "api", to: "seatmap", label: "Read availability", kind: "request" },
    { id: "hold", from: "api", to: "inventory", label: "Hold seats", kind: "request" },
    { id: "pay", from: "api", to: "payments", label: "Pay", kind: "request" },
    { id: "paid", from: "payments", to: "api", label: "Payment webhook", kind: "async" },
    { id: "confirmed", from: "api", to: "orders", label: "Order confirmed", kind: "async" },
    { id: "issue", from: "issuer", to: "orders", label: "Consume orders", kind: "request" },
    { id: "store", from: "issuer", to: "tickets", label: "Store ticket", kind: "data" },
    { id: "send", from: "issuer", to: "email", label: "Email ticket", kind: "request" },
    { id: "release", from: "sweeper", to: "inventory", label: "Release expired holds", kind: "request" },
  ],
  invariants: [
    {
      id: "seat-sold-once",
      statement: "A seat is sold to one buyer",
      enforcedBy: ["api", "inventory"],
      mechanism:
        "Conditional UPDATE on seats that takes only rows that are available or whose hold has expired; the transaction checks the row count and rolls back unless every requested seat was taken.",
    },
    {
      id: "hold-fenced",
      statement: "A payment for an expired hold does not sell the seat",
      enforcedBy: ["api", "inventory"],
      mechanism:
        "Conditional UPDATE from held to sold that matches the hold id and requires an unexpired hold; a zero row count sends the payment to a refund.",
    },
    {
      id: "admission-rate",
      statement: "The API sees at most the admitted rate",
      enforcedBy: ["waiting-room", "api"],
      mechanism:
        "The waiting room issues signed admission tokens with an expiry at a fixed rate; the API rejects any request without a valid token.",
    },
  ],
};
