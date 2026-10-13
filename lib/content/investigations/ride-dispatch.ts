import type { InvestigationInput } from "@/lib/domain/content";
import { md } from "../md";

/**
 * An original ride-hailing interview exercise. It uses public material about Uber's
 * H3 grid as a source for one design option; it does not describe Uber's private system.
 */
export const rideDispatch: InvestigationInput = {
  id: "ride-dispatch",
  title: "Matching riders and drivers across a busy city",
  searchTitle: "Design an Uber-Style Ride-Sharing System",
  answerSummary:
    "Store each ride request and driver reservation durably, then enqueue matching work through an outbox. Use a spatial cell index to find nearby drivers with fresh location pings, rank a small candidate set by road ETA, and issue expiring offers. Conditional state changes ensure one driver and one ride can be assigned only once, even when replies arrive late or twice.",
  premise:
    "Design the dispatch path for a ride-sharing marketplace: find nearby eligible drivers quickly, avoid assigning one driver twice, and recover when location data or notifications arrive late.",
  difficulty: "intermediate",
  estimatedMinutes: 45,
  scenario: md`
    A ride-hailing app lets a rider request a pickup and destination. The service finds nearby available drivers, estimates pickup time, offers the trip, and tracks the ride until it ends. A driver can be offered only one trip at a time, and a rider must never see two drivers accept the same request.

    In one large city, about **60,000 drivers** are online at peak. Each app sends a location update every **3 seconds** while available. The marketplace handles about **2,000 ride requests a minute on average**, with short **5× peaks** after events and during bad weather. A candidate offer should reach a driver in about a second. A stale map pin is worse than no pin: drivers who have not reported in ten seconds are not eligible for a new match.

    The design below is a practice problem, not a description of Uber's private architecture. Uber has publicly described H3, a hierarchical hexagonal grid used for marketplace analysis and dispatch-related decisions; the exercise asks you to choose and defend a design under its own assumptions.
  `,
  objectives: [
    "Estimate location-update and ride-request rates before choosing a storage design.",
    "Use a spatial index to narrow the candidate set, then use route ETA rather than straight-line distance to rank drivers.",
    "Reserve a driver and accept a ride with conditional state transitions so concurrent matches cannot double-assign either side.",
    "Expire stale locations and offers without losing accepted rides.",
    "Adapt when one venue creates a city-cell hotspot or a notification provider slows down.",
  ],
  prerequisites: ["partitioning", "idempotency", "leases-and-fencing"],
  requirements: {
    functional: [
      "Create a ride request with pickup and destination, then show its status to the rider.",
      "Find nearby eligible drivers and send them a trip offer with a pickup estimate.",
      "Let a driver accept or decline an offer, and let the rider cancel before pickup.",
      "Track driver location and trip state until pickup, completion, or cancellation.",
    ],
    nonFunctional: [
      "Return an initial driver offer within about one second at peak.",
      "Never assign one driver to two active trips or accept two drivers for one trip.",
      "Never match a driver whose last location update is more than ten seconds old.",
      "A delayed push notification must not create a second assignment or reverse a newer trip state.",
    ],
  },
  constraints: [
    "60,000 online drivers in the city, sending one location update every three seconds while available.",
    "2,000 ride requests a minute on average; peaks reach five times the average for several minutes.",
    "The first offer should be sent within about one second; pickup estimates should use road travel time.",
    "Start with one city and one primary database; the system may later expand to many cities and regions.",
  ],
  assumptions: [
    "A driver can take one active ride at a time, and available drivers opt in to location sharing.",
    "Location is a short-lived hint for matching, not the durable record of a completed trip.",
    "A routing service can estimate pickup time for a small candidate set, but calling it for every driver is too slow and costly.",
    "Push delivery is at least once in practice: messages can be delayed, retried, or arrive out of order.",
  ],
  competencies: [
    { id: "location-load", label: "Location-update load", description: "Sizing the high-volume stream of moving driver positions." },
    { id: "spatial-candidates", label: "Spatial candidate search", description: "Finding a small nearby set without scanning a whole city." },
    { id: "route-ranking", label: "Route-aware ranking", description: "Using road ETA after coarse geographic filtering." },
    { id: "exclusive-assignment", label: "Exclusive assignment", description: "Preventing two live matches from claiming the same ride or driver." },
    { id: "stale-state", label: "Freshness and recovery", description: "Rejecting stale pings, duplicate replies, and expired offers safely." },
  ],
  system: {
    components: [
      { id: "rider", label: "Rider app", kind: "client", responsibility: "Creates a ride request and receives versioned trip-state updates.", position: { col: 0, row: 0 } },
      { id: "driver", label: "Driver app", kind: "client", responsibility: "Sends sequenced location updates and accepts or declines a specific offer.", position: { col: 0, row: 2 } },
      { id: "api", label: "Ride API", kind: "edge", responsibility: "Authenticates requests, enforces per-client limits, and returns durable trip state.", position: { col: 1, row: 0 } },
      { id: "trip-store", label: "Trip and assignment store", kind: "database", responsibility: "Owns trip state, active driver reservation, offer ID, and state version.", durableState: "trip lifecycle and assignment decisions", position: { col: 2, row: 0 } },
      { id: "outbox", label: "Outbox and match queue", kind: "queue", responsibility: "Publishes committed trip-request events and retries match work by city.", durableState: "pending match and notification work", position: { col: 2, row: 1 } },
      { id: "matcher", label: "Dispatch workers", kind: "worker", responsibility: "Queries nearby candidates, checks eligibility, obtains route ETAs, and creates leased offers.", position: { col: 3, row: 1 } },
      { id: "locations", label: "Live location index", kind: "cache", responsibility: "Keeps the latest sequenced position, availability, cell, and expiry for each driver.", durableState: "None; rebuilt from fresh driver pings", position: { col: 3, row: 2 } },
      { id: "geo", label: "City-cell index", kind: "service", responsibility: "Maps a pickup to a cell and returns drivers in progressively wider neighboring cells.", position: { col: 4, row: 2 } },
      { id: "routing", label: "Route ETA service", kind: "external", responsibility: "Ranks a small candidate set by road pickup time, not just distance.", position: { col: 4, row: 0 } },
      { id: "notify", label: "Push and live updates", kind: "service", responsibility: "Delivers versioned offers and trip changes to rider and driver apps.", position: { col: 4, row: 1 } },
    ],
    flows: [
      { id: "request", from: "rider", to: "api", label: "Request a ride", kind: "request" },
      { id: "persist", from: "api", to: "trip-store", label: "Create REQUESTED trip", kind: "request" },
      { id: "enqueue", from: "trip-store", to: "outbox", label: "Commit match event", kind: "async" },
      { id: "work", from: "matcher", to: "outbox", label: "Claim city match work", kind: "request" },
      { id: "candidates", from: "matcher", to: "geo", label: "Search nearby cells", kind: "request" },
      { id: "positions", from: "geo", to: "locations", label: "Fresh available drivers", kind: "request" },
      { id: "eta", from: "matcher", to: "routing", label: "Road ETA for candidates", kind: "request" },
      { id: "offer", from: "matcher", to: "trip-store", label: "Lease offer and reserve driver", kind: "request" },
      { id: "push", from: "matcher", to: "notify", label: "Send versioned offer", kind: "async" },
      { id: "ping", from: "driver", to: "locations", label: "Sequenced location ping", kind: "push" },
      { id: "reply", from: "driver", to: "api", label: "Accept or decline offer ID", kind: "request" },
      { id: "updates", from: "notify", to: "rider", label: "Trip status version", kind: "push" },
    ],
    invariants: [
      {
        id: "one-active-driver-trip",
        statement: "A driver has at most one active assignment.",
        enforcedBy: ["trip-store", "api"],
        mechanism: "A conditional state transition reserves the driver for one offer ID; competing matches lose the compare-and-set and must try another candidate.",
      },
      {
        id: "one-accepted-driver",
        statement: "A ride has at most one accepted driver.",
        enforcedBy: ["trip-store", "api"],
        mechanism: "Accept changes the trip from OFFERED to ACCEPTED only when the offer ID and state version still match; duplicate or late replies are no-ops.",
      },
      {
        id: "fresh-match-location",
        statement: "Dispatch never offers a trip using an expired driver position.",
        enforcedBy: ["locations", "matcher"],
        mechanism: "Each ping carries a monotonic sequence and event time; the index expires entries after ten seconds, and the matcher checks freshness again before creating an offer.",
      },
      {
        id: "notifications-follow-state",
        statement: "A delayed notification cannot move a trip backwards.",
        enforcedBy: ["trip-store", "notify"],
        mechanism: "Messages carry the committed trip version and offer ID; clients ignore updates older than the last state they applied.",
      },
    ],
  },
  stages: [
    {
      id: "size-location-stream",
      title: "The location stream is the first bottleneck",
      phase: "model",
      dimensions: ["explain", "change"],
      conceptIds: ["partitioning", "backpressure"],
      competencyIds: ["location-load"],
      context: md`
        Start with the data that arrives whether or not anyone requests a ride. There are 60,000 online drivers, and every available driver sends one ping every three seconds. Ride requests average 2,000 a minute and briefly peak at five times that rate.
      `,
      lesson: [
        { kind: "read", body: md`For a periodic stream, divide the number of active senders by the reporting interval. Do not size a system only for the user action that looks most important: background location updates can outnumber ride requests by orders of magnitude.` },
        {
          kind: "estimate",
          id: "ping-rate",
          prompt: "60,000 drivers each send one location ping every 3 seconds. About how many pings per second reach the service?",
          answer: 20000,
          unit: "pings/second",
          tolerance: 0.1,
          working: md`60,000 ÷ 3 = **20,000 pings a second**. Peak ride requests are 2,000 × 5 ÷ 60 ≈ **167 a second**. Location updates are about 120 times as frequent, so they need a cheap, short-lived write path separate from durable trip history.` ,
        },
      ],
      interaction: {
        kind: "open",
        prompt: "What would you store for each location ping, and which location data would you persist durably? Explain the freshness and ordering rules.",
        placeholder: "Separate the live index from the trip record…",
        rubric: [
          { id: "latest-only", text: "Keeps only each driver's latest position in the fast matching index rather than appending every ping as durable trip data." },
          { id: "staleness", text: "Expires or rejects locations older than ten seconds." },
          { id: "ordering", text: "Uses a sequence number or timestamp so a delayed older ping cannot overwrite a newer position." },
        ],
        reference: md`Keep the latest position, availability, cell, sequence number, and received time in an expiring index. Persist trip transitions and the location samples required for an active trip or audit separately. A delayed ping with a lower sequence must not move a driver backwards. The raw location stream is high-volume and short-lived; the trip lifecycle is comparatively small and durable.`,
      },
      reveal: {
        takeaways: [
          "20,000 location pings/second versus about 167 peak ride requests/second.",
          "The live matching index and durable trip history have different retention and write requirements.",
          "Freshness and event order are correctness rules, not cache-tuning details.",
        ],
        reasoning: md`The location path dominates request count, so putting every ping into the same durable relational write path as trips couples cheap refreshes to expensive lifecycle guarantees. Keep a compact current-position index with a short TTL and a monotonic sequence. Durable storage owns the request, offer, acceptance, pickup, completion, and cancellation transitions. If a location is too old or out of order, discard it rather than making a confident match from stale data.`,
        otherwise: "Persisting a full location history can be appropriate for safety, billing, or regulation, but stream it to separate partitioned storage with an explicit retention policy; do not make the matcher scan that history.",
      },
      reveals: { components: ["locations", "trip-store"], flows: ["ping", "persist"] },
    },
    {
      id: "find-nearby-drivers",
      title: "Find candidates, then ask the road network",
      phase: "decide",
      dimensions: ["defend", "explain"],
      conceptIds: ["partitioning", "caching"],
      competencyIds: ["spatial-candidates", "route-ranking"],
      context: md`
        A city has tens of thousands of eligible drivers, but a ride request should not call the routing service for all of them. A spatial index needs to reduce the candidate set quickly without hiding a nearby driver just across a cell boundary.

        Uber has publicly described using H3, a hierarchical hexagonal grid, for marketplace analysis. It is one possible cell system, not a requirement for this design. See the [Uber H3 engineering post](https://www.uber.com/gb/en/blog/h3/).
      `,
      lesson: [
        { kind: "read", body: md`A spatial grid maps a coordinate to a cell. Query the pickup cell and its neighbors, reject unavailable or stale drivers, and expand outward if the candidate set is too small. Cell distance is a coarse filter: lakes, bridges, and one-way roads mean the closest point may not have the shortest pickup time.` },
      ],
      interaction: {
        kind: "decision",
        prompt: "How should the matcher find the first driver offer under the one-second budget?",
        options: [
          {
            id: "cells-then-eta",
            label: "Search the pickup cell and nearby cells, filter for fresh available drivers, then rank a small set by route ETA.",
            assessment: "sound",
            feedback: "This uses the grid to bound work and the road network for the decision that matters: pickup time. Expand the cell radius if too few eligible candidates remain.",
          },
          {
            id: "all-routes",
            label: "Ask the routing service for a route from the pickup to every online driver, then sort the results.",
            assessment: "flawed",
            feedback: "A routing call per driver makes the request fan out across tens of thousands of expensive calls and cannot meet the latency budget.",
          },
          {
            id: "fixed-cell",
            label: "Only consider drivers inside the exact pickup cell and send to the closest coordinate.",
            assessment: "flawed",
            feedback: "Cell boundaries can exclude a driver physically closer across the edge, and coordinate distance does not account for roads, barriers, or traffic.",
          },
          {
            id: "fixed-radius",
            label: "Query one fixed radius around the pickup and return no match if it is empty.",
            assessment: "defensible",
            feedback: "A strict service-area radius is simple and can be right for a product with a hard pickup limit. Under this prompt it will miss available drivers just outside the cutoff; retry with a larger radius or adjacent cells before reporting no match.",
          },
        ],
        rationale: {
          prompt: "Why use one geographic filter and then a different ranking signal?",
          rubric: [
            { id: "bounded", text: "The cell or radius lookup bounds the number of candidates." },
            { id: "eta", text: "Route ETA, rather than straight-line distance, decides pickup order." },
            { id: "expand", text: "Search widens when the first neighborhood has too few eligible drivers." },
          ],
        },
      },
      reveal: {
        takeaways: [
          "A spatial cell is a candidate index, not a guarantee of nearest-by-road ordering.",
          "Filter stale, occupied, and ineligible drivers before expensive routing calls.",
          "Progressive expansion avoids both an unbounded city scan and an arbitrary no-match boundary.",
        ],
        reasoning: md`The matcher first gets a bounded candidate set from the pickup cell and neighboring cells. It filters by availability, TTL, vehicle constraints, and current reservations, then requests route ETAs for a small batch. It offers in ETA order, or in a carefully chosen small parallel batch if a sequential offer would exceed the latency budget. The cell resolution and expansion policy are tuning decisions; measure empty searches, candidate count, ETA error, and dispatch latency by area before changing them.`,
        tradeoffs: [
          { choice: "Smaller cells", gains: "Fewer candidate drivers per lookup and less routing work.", costs: "More cells to query near boundaries and greater sensitivity to map density." },
          { choice: "Larger cells", gains: "Fewer index operations and a wider candidate pool in sparse areas.", costs: "More candidates to filter and route, especially in dense downtowns." },
        ],
        otherwise: "A geospatial database query with a distance index can replace a cell service at moderate scale. The design still needs a freshness cutoff and route-aware ranking; the data structure is an implementation choice.",
      },
      reveals: { components: ["geo", "matcher", "routing"], flows: ["candidates", "positions", "eta"] },
    },
    {
      id: "reserve-before-notify",
      title: "Reserve the driver before sending the offer",
      phase: "decide",
      dimensions: ["implement", "break"],
      conceptIds: ["idempotency", "leases-and-fencing", "delivery-guarantees"],
      competencyIds: ["exclusive-assignment"],
      context: md`
        Two match workers can process different ride requests at the same time and both see the same driver as available. A push provider can also retry an offer after a timeout, even though the first copy was delivered.
      `,
      lesson: [
        { kind: "read", body: md`A read followed by a write is not an exclusive claim. The reservation must be atomic with the state transition that creates the offer. Give each offer an ID and expiry, and make a driver's reply conditional on that exact ID and current trip version.` },
      ],
      interaction: {
        kind: "open",
        prompt: "Describe the atomic state change that makes it impossible for two trips to claim the same driver. What should happen if the notification times out after the database commit?",
        placeholder: "Name the rows, states, offer ID, and retry behavior…",
        rubric: [
          { id: "conditional-reserve", text: "Reserves only if the driver is still AVAILABLE, atomically changing it to RESERVED for one offer ID." },
          { id: "trip-condition", text: "Accepts only if the trip is still OFFERED for that offer ID and version." },
          { id: "retry-safe", text: "Retries notification delivery with the same offer ID; a timeout does not create a second reservation." },
          { id: "expiry", text: "Expires an unaccepted reservation and reopens matching after a bounded offer window." },
        ],
        reference: md`Use a transaction or conditional writes to reserve the driver and create the offer against the trip's current state. Persist an offer ID, expiry, and trip version before sending push. If the provider times out, retry delivery with the same ID. Duplicate accepts become no-ops; a late accept after expiry fails the state/version check. The offer lease is released only by a conditional transition that still refers to the same offer, so an old cleanup task cannot release a newer assignment.`,
      },
      reveal: {
        takeaways: [
          "Never trust an availability read as an assignment lock.",
          "Commit the offer identity and reservation before external notification.",
          "A timeout means the delivery result is unknown; retry with the same idempotency key.",
        ],
        reasoning: md`The durable store is the authority for assignment. The matcher uses an atomic conditional update from AVAILABLE to RESERVED and ties it to the ride and offer ID. The rider sees an offer only after this state commits. A driver accept conditionally advances that offer to ACCEPTED; a second worker or duplicate notification cannot create another accepted driver. When the offer expires, a compare-and-set checks the same offer ID before releasing the reservation.`,
        tradeoffs: [
          { choice: "One database transaction for trip and driver", gains: "A simple, explicit invariant for a city-level assignment store.", costs: "The transaction path may need careful partitioning and can contend on popular drivers." },
          { choice: "Separate trip and driver stores with a saga", gains: "Independent scaling and ownership of each data set.", costs: "Intermediate states and compensating release become part of correctness." },
        ],
        otherwise: "A market can send an offer to a small group at once to reduce wait time. Each candidate still needs a unique reservation, and the first valid acceptance wins through one conditional trip transition; losing reservations are released.",
      },
      reveals: { components: ["trip-store", "outbox", "notify"], flows: ["offer", "push", "reply"] },
    },
    {
      id: "stale-and-out-of-order",
      title: "A delayed location or offer cannot undo newer state",
      phase: "break",
      dimensions: ["trace", "break", "implement"],
      conceptIds: ["idempotency", "leases-and-fencing", "timeouts"],
      competencyIds: ["stale-state"],
      event: {
        kind: "failure",
        title: "A driver reconnects with a delayed batch of old pings",
        detail: "The newest position has sequence 82, but a retry delivers sequence 79 after it. A push notification for an expired offer arrives after the driver has accepted a later one.",
      },
      context: md`Mobile networks reconnect and replay work. Arrival order is not event order, so both the live-location record and the trip state need a rule that makes stale messages harmless.`,
      lesson: [
        { kind: "read", body: md`Keep a monotonic sequence on driver pings and a version on each trip transition. A consumer applies an event only if it advances the stored value. This works only when the compare and update are atomic; checking the version in application code and writing later reopens the race.` },
      ],
      interaction: {
        kind: "claims",
        prompt: "Which statements remain true when messages arrive late or more than once?",
        claims: [
          {
            id: "old-ping",
            statement: "A location ping with sequence 79 cannot overwrite the stored position at sequence 82.",
            verdict: "holds",
            explanation: "The index updates only when the incoming sequence is newer, using an atomic conditional write. The old ping is acknowledged or discarded without changing the current location.",
          },
          {
            id: "duplicate-accept",
            statement: "Retrying the same driver's accept request must return the same accepted-trip result.",
            verdict: "holds",
            explanation: "The offer ID and trip version make the operation idempotent. A repeat can report the already committed result but cannot create another assignment.",
          },
          {
            id: "late-old-offer",
            statement: "If a driver accepts an offer after its lease expired, the API should accept it because the push arrived late.",
            verdict: "fails",
            explanation: "The offer expiry and ID are part of the compare-and-set. A late reply is rejected, and the app receives the current trip state so it can refresh rather than create a conflicting assignment.",
          },
          {
            id: "push-order",
            statement: "Push delivery order is enough to keep the rider's screen correct.",
            verdict: "fails",
            explanation: "Push can arrive out of order. Each update needs a trip version; clients ignore versions older than the latest one they applied and can refetch durable state after a gap.",
          },
        ],
      },
      reveal: {
        takeaways: [
          "Sequence numbers protect the current location from replayed older pings.",
          "Offer IDs and versions make retries safe and expired responses rejectable.",
          "The server's durable trip state is authoritative; push is a delivery channel.",
        ],
        reasoning: md`The location index accepts a position only when its sequence exceeds the stored sequence and its age is within the TTL. The trip API makes every state transition conditional on the expected version and offer ID. If an old push arrives, the client ignores its lower version and fetches the current trip. If an accept arrives after the lease was replaced, the server rejects it and returns current state. Do not use wall-clock arrival time alone to order events from mobile clients.`,
      },
      reveals: { components: ["api", "locations", "notify"], flows: ["ping", "reply", "updates"] },
    },
    {
      id: "venue-hotspot",
      title: "An event lets out and one cell becomes hot",
      phase: "change",
      dimensions: ["change", "defend"],
      conceptIds: ["partitioning", "backpressure", "rate-limiting"],
      competencyIds: ["spatial-candidates", "stale-state"],
      event: {
        kind: "scale",
        title: "A stadium lets out during heavy rain",
        detail: "Requests in a few neighboring cells jump to 20× their normal rate. Thousands of drivers are crossing the same pickup area, and the routing service starts timing out.",
      },
      context: md`The city average hides local hotspots. A single popular cell can overload a partition, while increasing every worker's concurrency can send even more traffic to an already slow routing dependency.`,
      interaction: {
        kind: "open",
        prompt: "How do you keep matching responsive at the stadium without letting a routing slowdown or one hot cell take down the whole city?",
        placeholder: "Describe the partitions, limits, fallback, and user-visible behavior…",
        rubric: [
          { id: "local-partition", text: "Partitions or shards work by city and cell, and hot cells can split or use finer cells without relocating all city state." },
          { id: "dependency-budget", text: "Caps concurrent and per-request routing calls, with bounded retries and a timeout budget." },
          { id: "degrade", text: "Widen or defer candidate search and communicate delayed matching instead of falsely marking a ride assigned." },
          { id: "observe", text: "Measures dispatch latency, empty candidate sets, stale pings, cell skew, and routing error rate by area." },
        ],
        reference: md`Partition current locations and match work by city, then by spatial cell or a bounded set of adjacent cells. Split hot cells more finely or use a per-cell queue and concurrency budget; do not put every city behind one global queue. Limit route lookups per match, use short timeouts and a circuit breaker, and avoid retry storms. If exact ETAs are unavailable, use a clearly labeled coarse estimate or keep the request pending; never report a driver as assigned until the assignment transaction commits. Alert on per-cell queue age, candidate count, stale-location fraction, routing latency, offer acceptance, and unassigned-request rate.`,
      },
      reveal: {
        takeaways: [
          "Partition by where the work happens, and identify hot cells rather than relying on city averages.",
          "A slow routing dependency needs a concurrency budget and a bounded fallback, not unlimited retries.",
          "A delayed match is an honest state; an uncommitted assignment is not an assigned ride.",
        ],
        reasoning: md`Local queues and spatial shards isolate a stadium surge from the rest of the city. If one cell still dominates, subdivide it or split its workers and index while preserving a stable mapping for updates. Bound routing calls so a slow dependency does not accumulate an unbounded queue. The product can keep the rider informed that matching is delayed, then retry with a wider search or lower-fidelity ETA when safe. Track tail latency and match outcomes by cell to find the hotspot before a citywide dashboard does.`,
        tradeoffs: [
          { choice: "Fine cells and local queues", gains: "Better isolation and more control over hot areas.", costs: "More partitions, boundary queries, and operational state to manage." },
          { choice: "Coarse cells", gains: "Simpler index and fewer workers at ordinary traffic.", costs: "A popular venue can become one hot key and contaminate nearby requests." },
        ],
      },
      reveals: { components: ["outbox", "matcher", "geo", "routing"], flows: ["work", "candidates", "eta"] },
    },
  ],
  synthesis: {
    whyItWorks: md`The design separates three kinds of state that have different correctness needs. Driver location is a high-rate, expiring hint in a spatial index. A ride and its assignment are durable, versioned state transitions. Notifications are retriable messages that carry the IDs and versions of those transitions. A grid reduces the search space; route ETA ranks the remaining candidates; a conditional reservation decides who actually gets the trip. This lets the system tolerate delayed telemetry, retries, and local demand spikes without pretending that a map pin or push receipt is an assignment.`,
    reliesOn: [
      "Driver apps send sufficiently fresh, sequenced location updates and can tolerate occasional discarded pings.",
      "The assignment store supports atomic conditional state transitions or transactions for the ride and driver reservation.",
      "The routing service can return useful estimates for a bounded candidate batch within the request's latency budget.",
      "The cell index can widen or split searches without losing updates at cell boundaries.",
    ],
    alternatives: [
      { design: "Geospatial index in a relational database", preferWhen: "One region and moderate update volume make operational simplicity more valuable than a specialized write path." },
      { design: "Geohash or R-tree partitions", preferWhen: "The chosen database already supports these indexes well, and variable cell density or rectangle queries fit the workload." },
      { design: "H3-style hierarchical hexagonal cells", preferWhen: "Consistent global cells and hierarchical aggregation are useful across many cities and spatial analytics." },
      { design: "Sequential offers to the top candidate", preferWhen: "Driver acceptance is high and minimizing duplicate offers matters more than shaving the first-offer latency." },
      { design: "Small parallel offer batch", preferWhen: "Acceptance is slow or reliability targets require parallelism, and conditional reservations can release losing drivers quickly." },
    ],
    tradeoffs: [
      { choice: "Keep only the current driver position in the matcher index", gains: "Fast writes, bounded storage, and cheap freshness checks.", costs: "A separate, explicitly retained history is needed for trip replay, safety, or audit." },
      { choice: "Reserve before notifying", gains: "A push retry cannot make one driver appear available for two trips.", costs: "A slow or lost notification holds a short lease and needs expiry and cleanup." },
      { choice: "Progressively expand nearby cells", gains: "Fast common-case lookup without arbitrarily missing drivers at a cell edge.", costs: "Sparse areas can require additional queries and exceed the first-offer budget." },
    ],
    breaksWhen: [
      "GPS is inaccurate or spoofed; use plausibility checks, device integrity signals, and driver-side safeguards before treating a point as truth.",
      "A single metro area exceeds one cell or database shard; split by city and subregion while keeping trip ownership stable.",
      "The routing service is unavailable long enough that no trustworthy pickup ETA can be returned; matching must expose a degraded or pending state.",
      "Drivers can accept multiple ride types or pooled trips; the one-active-trip invariant must become a capacity and route-compatibility model.",
      "Regulation or safety policy requires durable location history; move that history to a separately retained, access-controlled stream rather than the hot matching index.",
    ],
  },
  interviewVariants: [
    "Design Uber or Lyft's ride-sharing dispatch system.",
    "Find the nearest available driver to a pickup under a one-second latency target.",
    "Design a real-time driver-location service for multiple cities.",
    "Match couriers to delivery orders while preventing duplicate assignments.",
    "Handle a stadium event that creates a sudden, localized demand spike.",
  ],
  relatedInvestigationIds: ["notification-system", "api-rate-limiter", "news-feed"],
};
