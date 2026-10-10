import type { ExampleProjectInput } from "@/lib/domain/content";

export const teamChat: ExampleProjectInput = {
  id: "team-chat",
  name: "Team chat (example)",
  category: "realtime",
  summary:
    "A Slack-like chat with channels, presence and mobile push. WebSocket gateways hold client connections and receive channel events from a pub/sub bus; the API writes messages to Postgres, Redis tracks presence and APNs/FCM reaches offline members. Replace any part with how your own system works.",
  scale: "300k daily users, 2k messages/s peak, 1.5M open sockets",
  focusConceptIds: [
    "ordering",
    "persistent-connections",
    "publish-subscribe",
    "soft-state",
    "fan-out",
    "server-push",
    "idempotency",
  ],
  relatedInvestigationIds: ["chat-message-store", "notification-system"],
  components: [
    {
      id: "app",
      label: "Client apps",
      kind: "client",
      responsibility: "Web and mobile clients that show channels and send messages.",
    },
    { id: "lb", label: "Load balancer", kind: "edge", responsibility: "Routes WebSocket upgrades to gateway nodes." },
    {
      id: "gateway",
      label: "WebSocket gateway",
      kind: "service",
      responsibility: "Holds client sockets and delivers channel events to the members connected to this node.",
    },
    {
      id: "api",
      label: "Chat API",
      kind: "service",
      responsibility: "Sends messages, serves history and manages channels.",
    },
    {
      id: "postgres",
      label: "Postgres",
      kind: "database",
      responsibility: "Workspaces, channels, memberships and messages, with the per-channel sequence counter.",
      durableState: "workspaces, channels, memberships, messages partitioned by channel",
    },
    {
      id: "presence",
      label: "Redis presence",
      kind: "cache",
      responsibility: "Online and typing keys, each with a TTL refreshed by heartbeats.",
    },
    {
      id: "bus",
      label: "Event bus",
      kind: "stream",
      responsibility: "Carries channel events between gateway nodes on NATS or Redis pub/sub.",
    },
    {
      id: "push-worker",
      label: "Push worker",
      kind: "worker",
      responsibility: "Notifies members who have no open socket.",
    },
    { id: "push", label: "APNs and FCM", kind: "external", responsibility: "Delivers push notifications to phones." },
    {
      id: "files",
      label: "Attachment storage",
      kind: "object-store",
      responsibility: "Stores uploaded attachments.",
      durableState: "attachments",
    },
  ],
  flows: [
    { id: "connect", from: "app", to: "lb", label: "Open WebSocket", kind: "request" },
    { id: "route", from: "lb", to: "gateway", label: "Upgrade to socket", kind: "request" },
    { id: "send", from: "app", to: "api", label: "Send message", kind: "request" },
    { id: "persist", from: "api", to: "postgres", label: "Insert message", kind: "request" },
    { id: "publish", from: "api", to: "bus", label: "Publish channel event", kind: "async" },
    { id: "fanout", from: "bus", to: "gateway", label: "Deliver to subscribed nodes", kind: "async" },
    { id: "deliver", from: "gateway", to: "app", label: "Push new messages", kind: "push" },
    { id: "heartbeat", from: "gateway", to: "presence", label: "Refresh presence TTL", kind: "request" },
    { id: "history", from: "app", to: "api", label: "Load history", kind: "request" },
    { id: "offline", from: "bus", to: "push-worker", label: "Events for offline members", kind: "async" },
    { id: "notify", from: "push-worker", to: "push", label: "Send push", kind: "request" },
    { id: "attach", from: "app", to: "files", label: "Upload attachment", kind: "data" },
  ],
  invariants: [
    {
      id: "channel-order",
      statement: "Everyone sees a channel's messages in the same order",
      enforcedBy: ["api", "postgres"],
      mechanism:
        "Per-channel sequence from UPDATE channels SET last_seq = last_seq + 1 RETURNING in the insert transaction; clients sort by seq and fetch gaps.",
    },
    {
      id: "send-once",
      statement: "A retried send never duplicates a message",
      enforcedBy: ["api", "postgres"],
      mechanism: "Client-generated message id with a unique constraint; a duplicate returns the stored message.",
    },
    {
      id: "presence-expires",
      statement: "A user whose gateway died stops showing online within a minute",
      enforcedBy: ["presence", "gateway"],
      mechanism: "Presence keys have a 60 s TTL refreshed by heartbeats; nothing deletes them on crash.",
    },
  ],
};
