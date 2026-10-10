import type { ExampleProjectInput } from "@/lib/domain/content";

export const iotTelemetry: ExampleProjectInput = {
  id: "iot-telemetry",
  name: "Device telemetry platform (example)",
  category: "iot",
  summary:
    "Sensors publish readings over MQTT into a Kafka log. A batch writer loads a time-series store, a rules engine pages on alerts, and Postgres holds devices, credentials and firmware. Replace any part with how your own system works.",
  scale: "20k readings/s sustained, 13 months retention",
  focusConceptIds: [
    "partitioning",
    "event-log",
    "ordering",
    "backpressure",
    "columnar-storage",
    "delivery-guarantees",
    "state-machines",
  ],
  relatedInvestigationIds: ["product-analytics"],
  components: [
    { id: "devices", label: "Sensors", kind: "client", responsibility: "Firmware that publishes a reading every 10 seconds." },
    { id: "broker", label: "MQTT broker", kind: "edge", responsibility: "Holds device connections and forwards published readings." },
    { id: "ingest", label: "Ingest", kind: "service", responsibility: "Validates readings and bridges MQTT messages into Kafka." },
    {
      id: "readings",
      label: "Kafka",
      kind: "stream",
      responsibility: "Log of readings keyed by device id, so each device maps to one partition.",
      durableState: "3 days of readings",
    },
    {
      id: "writer",
      label: "Batch writer",
      kind: "worker",
      responsibility: "Consumes readings and batch-inserts them into the time-series store.",
    },
    {
      id: "tsdb",
      label: "Time-series store",
      kind: "database",
      responsibility: "Stores raw readings and rollups for queries.",
      durableState: "readings, rollups",
    },
    {
      id: "rules",
      label: "Rules engine",
      kind: "worker",
      responsibility: "Evaluates alert rules over windows of readings and tracks each incident's state.",
    },
    {
      id: "registry",
      label: "Postgres",
      kind: "database",
      responsibility: "Stores devices, credentials, firmware versions and alert state.",
      durableState: "devices, credentials, firmware, alert state",
    },
    { id: "alerts", label: "Paging and SMS", kind: "external", responsibility: "Delivers pages and SMS for firing alerts." },
    { id: "api", label: "Query API", kind: "service", responsibility: "Answers dashboard queries from the time-series store." },
    { id: "dashboard", label: "Dashboard", kind: "client", responsibility: "Operator UI for charts, alerts and device status." },
    {
      id: "archive",
      label: "Object storage",
      kind: "object-store",
      responsibility: "Holds Parquet files for readings older than 30 days.",
      durableState: "Parquet files older than 30 days",
    },
    {
      id: "compactor",
      label: "Compactor",
      kind: "worker",
      responsibility: "Builds rollups and exports old data to archive storage.",
    },
  ],
  flows: [
    { id: "report", from: "devices", to: "broker", label: "Publish reading", kind: "async" },
    { id: "bridge", from: "broker", to: "ingest", label: "Forward messages", kind: "async" },
    { id: "append", from: "ingest", to: "readings", label: "Append to log", kind: "async" },
    { id: "consume", from: "writer", to: "readings", label: "Consume readings", kind: "request" },
    { id: "insert", from: "writer", to: "tsdb", label: "Batch insert", kind: "data" },
    { id: "evaluate", from: "rules", to: "readings", label: "Consume for rules", kind: "request" },
    { id: "page", from: "rules", to: "alerts", label: "Send alert", kind: "request" },
    { id: "device-auth", from: "broker", to: "registry", label: "Authenticate device", kind: "request" },
    { id: "query", from: "dashboard", to: "api", label: "Load charts", kind: "request" },
    { id: "series", from: "api", to: "tsdb", label: "Query series", kind: "request" },
    { id: "rollup", from: "compactor", to: "tsdb", label: "Roll up old data", kind: "request" },
    { id: "export", from: "compactor", to: "archive", label: "Write Parquet", kind: "data" },
  ],
  invariants: [
    {
      id: "device-order",
      statement: "A device's readings are processed in order",
      enforcedBy: ["ingest", "readings"],
      mechanism:
        "Kafka key = device id, so one partition per device; readings carry a device sequence number.",
    },
    {
      id: "no-duplicate-readings",
      statement: "Redelivered readings are stored once",
      enforcedBy: ["writer", "tsdb"],
      mechanism:
        "Unique (device_id, ts, seq) with ON CONFLICT DO NOTHING; offsets committed after the insert.",
    },
    {
      id: "alert-once",
      statement: "An incident pages once, not every window",
      enforcedBy: ["rules", "registry"],
      mechanism:
        "Per (rule, device) state row in the registry; the ok → firing transition is a conditional UPDATE WHERE state = 'ok', so only one window pages. Resolving waits for hysteresis (several clean windows).",
    },
  ],
};
