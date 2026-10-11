import type { InvestigationInput } from "@/lib/domain/content";
import { md } from "../md";

/** An original interview scenario informed by public engineering writeups, not a Dropbox replica. */
export const fileStorageSync = {
  id: "file-storage-sync",
  title: "Keeping files in sync across devices",
  searchTitle: "Design a Dropbox-Style File Sync Service",
  premise:
    "Design file storage that survives café Wi-Fi, laptop crashes and two devices editing offline: move large files without restarting, publish metadata only after its bytes are durable, and let every device catch up without polling the whole account.",
  difficulty: "intermediate",
  estimatedMinutes: 50,
  scenario: md`
    A cloud drive keeps a user's folders available on their laptop, phone and browser. A desktop client watches local files, uploads changes, and downloads updates made on other devices. Users can share folders, work offline, rename and delete files, and restore earlier versions.

    The service has **8 million daily active users** and **400 million stored files**. On a busy day users change 20 million files. Most are small documents, but a few are multi-gigabyte videos. Many clients disconnect mid-transfer; a laptop may be offline for weeks and must catch up when it returns.

    The first version sends each whole file through one API request, then writes a row with its path and storage key. A timeout makes clients start over. Two devices editing the same file can silently overwrite one another, and the server sends every client a full folder listing after any change.

    This is an original practice design. Public Dropbox engineering posts inform a few specific trade-offs; the workload, APIs and architecture below are assumptions for the exercise, not a description of Dropbox or Google Drive internals.
  `,
  objectives: [
    "Estimate transfer volume and distinguish small-file overhead from large-file bandwidth.",
    "Separate mutable file metadata from immutable content blocks and publish versions safely.",
    "Resume interrupted uploads and avoid transferring bytes the server already has.",
    "Let offline clients catch up from a durable, ordered change cursor.",
    "Preserve concurrent edits and prevent revoked shares from exposing old content.",
    "Reclaim deleted content without racing restores, old versions or in-flight uploads.",
  ],
  prerequisites: ["object-storage", "transactions", "idempotency", "partitioning"],
  requirements: {
    functional: [
      "Upload, download, rename, move, share, delete and restore files.",
      "Sync changes to every authorized device, including devices that reconnect after weeks offline.",
      "Resume an interrupted large upload and fetch only missing content blocks.",
      "Preserve both versions when concurrent edits cannot be safely merged.",
    ],
    nonFunctional: [
      "A completed file version never points to content that has not been durably stored.",
      "A retry cannot publish a duplicate version or apply a rename twice.",
      "An ordinary change reaches online devices within a few seconds; reconnecting devices can page through all missed changes.",
      "Revoking access prevents new reads promptly, including reads through previously issued download links.",
      "One account with many files or devices does not create unbounded work for other accounts.",
    ],
  },
  constraints: [
    "8 million daily active users; 400 million files stored; 20 million changed files on a busy day.",
    "Small documents are common; the long tail includes files several gigabytes in size.",
    "Clients can disappear between any two requests and may return with stale local state.",
    "The team can operate a relational metadata database and a durable object store; exact vendors are open.",
  ],
  assumptions: [
    "A changed file averages 2 MB after compression; 20 million changes is about 40 TB of new bytes before deduplication and replication.",
    "A file version is an ordered list of immutable content blocks plus metadata; a block can be shared by multiple versions.",
    "The metadata journal is authoritative for file names, versions, permissions and sync cursors; notifications are only a wake-up hint.",
    "Native collaborative document editing is out of scope; this service syncs file versions, not simultaneous keystrokes.",
  ],
  competencies: [
    { id: "sizing", label: "Sizing transfers", description: "Translate daily changes and file sizes into bandwidth and storage." },
    { id: "content-layout", label: "Separating bytes and metadata", description: "Choose block and version boundaries that make edits, reads and recovery tractable." },
    { id: "safe-publication", label: "Publishing complete versions", description: "Order storage writes and metadata commits so readers never see partial files." },
    { id: "device-sync", label: "Catching devices up", description: "Use durable cursors and bounded pages when clients reconnect." },
    { id: "conflict-policy", label: "Resolving concurrent edits", description: "Detect stale writes and preserve work when automatic merge is unsafe." },
    { id: "authorization", label: "Enforcing current permissions", description: "Make sharing and revocation apply across metadata, blocks and cached links." },
    { id: "storage-reclamation", label: "Reclaiming old blocks", description: "Delete unreferenced content safely without racing restores and uploads." },
  ],
  system: {
    components: [
      { id: "devices", label: "Desktop and mobile clients", kind: "client", responsibility: "Watch local files, hash content, persist upload state and sync cursors, and apply authorized remote changes.", position: { col: 0, row: 1 } },
      { id: "api", label: "File API", kind: "edge", responsibility: "Authenticates each operation, checks current access, validates preconditions and routes metadata or block requests.", position: { col: 1, row: 1 } },
      { id: "metadata", label: "Metadata service", kind: "service", responsibility: "Owns namespaces, paths, versions, permission checks and the append-only change journal.", durableState: "file tree, version manifests, permissions and per-namespace journal sequence", position: { col: 2, row: 1 } },
      { id: "database", label: "Metadata database", kind: "database", responsibility: "Stores current metadata and a durable, ordered journal partitioned by namespace.", durableState: "authoritative metadata and sync history", position: { col: 3, row: 0 } },
      { id: "blocks", label: "Immutable block store", kind: "object-store", responsibility: "Stores verified block bytes by content hash; blocks are written once and read by authorized clients.", durableState: "content blocks until no retained version references them", position: { col: 3, row: 2 } },
      { id: "notifier", label: "Change notifier", kind: "service", responsibility: "Wakes online devices when a namespace journal advances; missed notifications are recovered from the journal.", position: { col: 4, row: 1 } },
      { id: "gc", label: "Garbage collector", kind: "worker", responsibility: "Marks blocks reachable from retained versions, then deletes only blocks that remain unreferenced after a safety delay.", position: { col: 4, row: 2 } },
    ],
    flows: [
      { id: "file-ops", from: "devices", to: "api", label: "Upload, download and sync requests", kind: "request" },
      { id: "metadata-ops", from: "api", to: "metadata", label: "Conditional metadata operations", kind: "request" },
      { id: "commit", from: "metadata", to: "database", label: "Commit version and append journal row", kind: "request" },
      { id: "transfer", from: "api", to: "blocks", label: "Upload or fetch verified blocks", kind: "data" },
      { id: "notify", from: "database", to: "notifier", label: "Journal advanced", kind: "async" },
      { id: "wake", from: "notifier", to: "devices", label: "Wake, then page from cursor", kind: "push" },
      { id: "reclaim", from: "gc", to: "blocks", label: "Delete unreachable blocks after grace period", kind: "async" },
    ],
    invariants: [
      { id: "complete-manifest", statement: "A visible file version references only blocks that were fully received, hash-verified and durably stored first.", enforcedBy: ["api", "metadata", "database", "blocks"], mechanism: "Upload missing blocks first; then use a conditional metadata transaction to commit the manifest and append its change row. A crash before commit leaves harmless unreferenced blocks; a crash after commit cannot leave missing bytes." },
      { id: "ordered-catchup", statement: "A client can resume after any interruption without skipping a committed namespace change.", enforcedBy: ["metadata", "database", "devices"], mechanism: "Each namespace has a monotonic journal sequence. Page all rows after the client's durable cursor, and advance that cursor only after applying a whole page." },
      { id: "current-access", statement: "A revoked user cannot use an old metadata result or download URL to fetch a block indefinitely.", enforcedBy: ["api", "metadata", "blocks"], mechanism: "Authorize block reads against current file or namespace policy; if short-lived signed URLs are used, bound their lifetime and account for revocation propagation." },
      { id: "safe-gc", statement: "Garbage collection never deletes a block reachable from a retained or newly restored version.", enforcedBy: ["metadata", "database", "gc", "blocks"], mechanism: "Trace references from all retained manifests, recheck before deletion, and wait through the maximum in-flight upload, restore and metadata replication delay." },
    ],
  },
  stages: [
    {
      id: "size-the-transfer",
      title: "The bytes behind a sync",
      phase: "model",
      dimensions: ["explain", "change"],
      conceptIds: ["object-storage"],
      competencyIds: ["sizing"],
      context: md`Use 86,400 seconds per day. The stated 2 MB average is after compression; it is deliberately a first estimate, not a claim about a production file distribution.`,
      lesson: [
        { kind: "estimate", id: "daily-bytes", prompt: "20 million changed files averaging 2 MB each produce how much new content per day, before deduplication?", answer: 40, unit: "TB", working: md`20,000,000 × 2 MB = **40,000,000 MB**, or about **40 TB per day** in decimal units. Replication, metadata, old versions and retries add more; deduplication may reduce stored bytes but should not be assumed for capacity planning.` },
        { kind: "estimate", id: "average-rate", prompt: "If those 40 TB arrive evenly over a day, what average payload bandwidth does the service receive?", answer: 463, unit: "MB/s", tolerance: 0.35, working: md`40 TB ÷ 86,400 seconds ≈ **463 MB/s** aggregate, before protocol overhead and peak-to-average variation. This is a fleet-wide flow, not what one API server should stream through its request memory.` },
        { kind: "read", body: md`The workload has two different costs. Small files are dominated by request, hashing and metadata overhead; large files are dominated by bytes on the wire and interruption risk. A design that treats every file as one HTTP body pays both costs badly.` },
      ],
      interaction: { kind: "claims", prompt: "Which conclusions follow from the workload?", claims: [
        { id: "traffic-volume", statement: "At the given average, the service receives about 40 TB of changed file content per day before deduplication.", verdict: "holds", explanation: "20 million × 2 MB is 40 TB in decimal units. Replication and retained history affect storage, while bursts affect peak bandwidth." },
        { id: "one-request", statement: "A single request carrying the entire file is a good default because it uses fewer API calls.", verdict: "fails", explanation: "It cannot resume a multi-gigabyte transfer after a timeout, and it ties API connection lifetime and memory pressure to file size. Small files may still be sent in one request; large transfers need bounded resumable pieces." },
        { id: "dedup-all", statement: "Content-addressed blocks guarantee that storage will be much smaller than the source bytes.", verdict: "depends", explanation: "Identical blocks can be reused, but encrypted or already-compressed data may differ even when files look similar. Capacity planning should use measured deduplication, not assume it." },
      ] },
      reveal: { takeaways: ["The average input alone is about 40 TB/day before deduplication.", "Large transfers need bounded retries; small files need low per-request overhead.", "Treat measured deduplication as an optimization, not a durability assumption."], reasoning: md`Sizing establishes why bytes and metadata should take different paths. A few hundred megabytes per second of average payload is a system-level budget; each API process should validate and authorize transfers without buffering whole files. Peak load and geographic egress still need explicit targets before choosing regions or hardware.` },
      reveals: { components: ["devices", "api"], flows: ["file-ops"] },
    },
    {
      id: "blocks-and-versions",
      title: "Store content once, describe versions separately",
      phase: "decide",
      dimensions: ["explain", "defend"],
      conceptIds: ["object-storage", "idempotency"],
      competencyIds: ["content-layout"],
      context: md`A user edits a 2 GB video, changing a small region near the end. The first version stores the whole file as one mutable object. The next version must avoid retransmitting unchanged content and must remain readable while the new one is being uploaded.`,
      lesson: [
        { kind: "read", body: md`Split file bytes into bounded blocks and identify each block by a cryptographic hash. A version manifest stores an ordered list of block IDs plus file metadata. Immutable blocks are simple to retry and cache; mutable meaning lives in the version manifest, not inside the block store.` },
        { kind: "choice", id: "layout", prompt: "Which representation best supports large-file edits and retries?", options: [
          { id: "whole-object", label: "Overwrite one object and keep a temporary copy while the upload runs.", why: "This can work for a small service, but a retry still transfers the entire file and readers need careful version handling." },
          { id: "immutable-blocks", label: "Store verified immutable blocks by hash; publish a version manifest that references them.", correct: true, why: "Unchanged blocks can be reused, retries are idempotent by block hash, and the old manifest remains the visible version until the new manifest commits." },
          { id: "mutable-blocks", label: "Give each file fixed block offsets and overwrite each block in place.", why: "Readers can observe a mixture of old and new blocks, and an interrupted write destroys part of the previous version unless every block has separate versioning." },
        ] },
        { kind: "read", body: md`For a large upload, the client first sends its proposed block list. The service returns which hashes are already durable; the client uploads only the missing blocks with bounded concurrency. After a disconnect, it can repeat that negotiation and resume. The server does not need to trust a remembered session to know which bytes exist: it checks the durable block index again.` },
        { kind: "read", body: md`Content hashes are identifiers and integrity checks, not authorization tokens. A block store still needs a policy for who may read a hash; otherwise a guessed or leaked identifier can expose data across users.` },
      ],
      interaction: { kind: "decision", prompt: "A client retries a block upload after losing the response. Choose the server behavior.", options: [
        { id: "verify-hash", label: "Verify the bytes against the claimed hash, then treat an existing matching block as success.", assessment: "sound", feedback: "The hash makes the write idempotent, and verifying it protects against corruption or a client bug." },
        { id: "trust-name", label: "Trust the client's hash and overwrite whichever bytes are stored under it.", assessment: "flawed", feedback: "A key is not proof that the bytes match. Overwriting also breaks immutability and could corrupt old manifests." },
        { id: "new-id", label: "Create a fresh random block ID on every retry.", assessment: "flawed", feedback: "The retry creates duplicate content and the client has no stable identifier to resume with." },
      ], rationale: { prompt: "Explain why retries of a block write are safe and what the server verifies.", rubric: [
        { id: "stable-id", text: "Reuses the content hash as a stable idempotency key." },
        { id: "verify", text: "Checks received bytes against the hash before accepting them." },
        { id: "immutable", text: "Does not overwrite a different existing block under the same key." },
      ] } },
      reveal: { takeaways: ["Keep immutable bytes separate from mutable file/version metadata.", "A content hash supports reuse and retry, but the server must verify it.", "A manifest is the atomic switch that makes a new version visible."], reasoning: md`Block size is a trade-off: smaller blocks improve reuse after localized edits but increase hashes and metadata; larger blocks reduce metadata while retransmitting more unchanged bytes. Dropbox has publicly described blocks up to 4 MiB in specific systems, but that is evidence about their workload, not a universal optimum. Choose from this product's edit patterns and measure.` },
      reveals: { components: ["metadata", "database", "blocks"], flows: ["metadata-ops", "commit", "transfer"] },
    },
    {
      id: "publish-safely",
      title: "Make the file appear only when it is complete",
      phase: "break",
      dimensions: ["trace", "break", "implement"],
      conceptIds: ["transactions", "idempotency"],
      competencyIds: ["safe-publication"],
      event: { kind: "failure", title: "The client crashes between block uploads", detail: "It has sent most blocks, but the metadata database is unavailable before the new file version can be committed." },
      context: md`The client knows the desired block hashes. Some blocks already exist; two are missing. The file must not become visible with missing data. The client may retry after an unknown number of successful writes.`,
      lesson: [
        { kind: "choice", id: "write-order", prompt: "When should the service publish a new version manifest?", options: [
          { id: "after-blocks", label: "After all missing blocks have been verified and durably stored, using a conditional metadata transaction.", correct: true, why: "The visible manifest can now resolve every block. A crash before commit leaves the previous version intact and only harmless orphan bytes." },
          { id: "before-blocks", label: "Before uploading blocks, then let clients wait for the missing bytes to arrive.", why: "A committed manifest becomes visible immediately and can point to absent data if a later upload fails." },
          { id: "notify-first", label: "After notifying devices, then write the metadata and blocks asynchronously.", why: "A notification is a wake-up hint, not a commit protocol. Devices may fetch a version that does not yet exist or is incomplete." },
        ] },
        { kind: "read", body: md`The safe sequence is: authenticate and validate the expected current revision; upload missing blocks and wait for durable acknowledgements; conditionally commit the new manifest and append its journal row in one metadata transaction; then notify online devices. If the process crashes before commit, the previous version is still visible and the new blocks are harmless orphans. If it crashes after commit, every referenced block was already acknowledged as durable. Notifications follow the commit and can be retried.` },
        { kind: "read", body: md`The commit should compare the current file revision with the revision the client edited. This is a compare-and-swap: only one writer based on revision 12 can publish revision 13. A second writer gets a conflict response and can preserve its content as a separate version instead of silently replacing the winner.` },
      ],
      interaction: { kind: "claims", prompt: "The database recovers after the upload failure. Which statements are correct?", claims: [
        { id: "orphan-safe", statement: "Blocks uploaded before the metadata transaction may be unreferenced, but the previous file version remains readable.", verdict: "holds", explanation: "Immutable blocks are not user-visible by themselves. Without a committed manifest, readers continue to resolve the old version." },
        { id: "db-first", statement: "Commit the manifest first and upload its missing blocks afterward to shorten the metadata transaction.", verdict: "fails", explanation: "A crash or storage outage after the commit leaves a visible version whose manifest points to missing bytes." },
        { id: "notify-authority", statement: "If the push notification is lost, the other device can still discover the update.", verdict: "holds", explanation: "Notifications wake clients; the durable journal is the source of truth. The client resumes from its cursor even if it missed the wake-up." },
      ] },
      reveal: { takeaways: ["Store and verify all referenced blocks before committing the new manifest.", "Use a conditional revision check to detect concurrent writes.", "Push is a hint; the metadata journal is the durable change record."], reasoning: md`No transaction spans object storage and the metadata database. Correctness comes from choosing an order where the partial failure leaves harmless orphan data rather than a broken visible file. Idempotent block writes make retries safe; a later mark-and-sweep collector handles abandoned blocks.` },
      reveals: { components: ["notifier"], flows: ["notify"] },
    },
    {
      id: "offline-devices",
      title: "Catch up from a durable cursor",
      phase: "decide",
      dimensions: ["trace", "explain", "change"],
      conceptIds: ["partitioning", "asynchronous-processing"],
      competencyIds: ["device-sync"],
      context: md`A laptop has been asleep for three weeks. During that time its owner changed 80 files and a shared folder received 12,000 changes. The phone is online and expects updates within a few seconds.`,
      lesson: [
        { kind: "read", body: md`Give each namespace an ordered journal and each device a durable cursor. A client requests changes after its cursor in bounded pages, applies them, then saves the cursor. If it crashes while applying a page, it can safely repeat it using stable change IDs and idempotent local operations.` },
        { kind: "choice", id: "catch-up", prompt: "What should a reconnecting device do after missing notifications?", options: [
          { id: "full-scan", label: "Download the entire folder tree and compare every file hash.", why: "A full scan can repair a client with corrupt local state, but using it for ordinary catch-up makes work proportional to the account rather than missed changes." },
          { id: "journal", label: "Page through durable journal entries after its saved cursor, then fetch blocks for changed versions.", correct: true, why: "Work scales with missed changes, and the same journal handles both push wake-ups and long-offline recovery." },
          { id: "push-only", label: "Trust push notifications and assume each missed notification will be replayed by the provider.", why: "Push providers are not a durable account history. A device can miss a notification while asleep or offline." },
        ] },
        { kind: "read", body: md`A cursor expires only if the server has compacted the journal past it. Make that response explicit: tell the client to rebuild from a snapshot at sequence S, then continue after S. Silently returning only recent changes would leave the device permanently inconsistent.` },
      ],
      interaction: { kind: "decision", prompt: "The client applied changes through sequence 812 but crashed before saving its cursor, still 790. What is safe on restart?", options: [
        { id: "replay", label: "Request after 790 again and reapply the overlapping page idempotently.", assessment: "sound", feedback: "At-least-once replay is safe when changes have stable IDs and local application records or tolerates duplicate application." },
        { id: "skip", label: "Jump to the server's current high-water mark to avoid duplicate work.", assessment: "flawed", feedback: "That skips every change after 790 that the client had not actually committed locally." },
        { id: "local-time", label: "Use the file modification times on disk to reconstruct the missing cursor.", assessment: "flawed", feedback: "Wall clocks can differ, and local timestamps do not represent the server's ordered metadata history." },
      ], rationale: { prompt: "Explain when the cursor advances and how replay avoids gaps.", rubric: [
        { id: "commit-local", text: "Advances the cursor only after the page's local changes are durably applied." },
        { id: "replay", text: "Allows overlap and makes repeated change application idempotent." },
      ] } },
      reveal: { takeaways: ["Notifications wake devices; durable cursors let them recover missed changes.", "Paginated journals make reconnect work proportional to the change backlog.", "An expired cursor needs a snapshot-and-resume protocol, not silent truncation."], reasoning: md`A cursor is a compact promise about history: the client has durably applied every change through sequence N. Advance it only with the corresponding local state. If the journal is partitioned by namespace, clients can catch up on independent namespaces in parallel while preserving order within each one.` },
      reveals: { components: ["devices"], flows: ["wake"] },
    },
    {
      id: "concurrent-edits",
      title: "Two offline edits are both real work",
      phase: "break",
      dimensions: ["break", "defend"],
      conceptIds: ["concurrency-control"],
      competencyIds: ["conflict-policy"],
      event: { kind: "failure", title: "Both devices edited revision 12", detail: "The phone and laptop were offline, each changed the same file, and both reconnect with a candidate version based on revision 12." },
      context: md`The files can be arbitrary binaries: text documents, photos, archives or video. The server does not know whether merging bytes would preserve the user's intent.`,
      lesson: [
        { kind: "read", body: md`A last-write-wins update silently discards one valid edit. Compare the client's base revision to the current revision at commit. If they differ, preserve both versions or create an explicit conflict copy. A product-specific merge is appropriate only when the format has a safe, well-defined merge algorithm.` },
        { kind: "choice", id: "merge-policy", prompt: "Both versions changed since revision 12. What is the default for arbitrary files?", options: [
          { id: "last-write", label: "Accept whichever upload arrives last and delete the other candidate.", why: "Arrival order reflects network timing, not user intent; the first edit is lost without a recovery path." },
          { id: "conflict-copy", label: "Keep the current version and store the other as a named conflict copy linked to its base revision.", correct: true, why: "Both edits remain recoverable. A text-aware merge can be added for formats where the merge semantics are explicit." },
          { id: "timestamp", label: "Choose the file with the latest device clock timestamp.", why: "Client clocks drift and can be changed. Timestamps do not prove which edit includes the other's work." },
        ] },
      ],
      interaction: { kind: "claims", prompt: "Which statements are safe design choices?", claims: [
        { id: "cas", statement: "A conditional write on expected revision detects that a device edited stale content.", verdict: "holds", explanation: "The metadata database can atomically compare the current revision before publishing a new manifest." },
        { id: "merge-all", statement: "Because each file is split into blocks, independently changed blocks can always be combined safely.", verdict: "fails", explanation: "Block boundaries are a storage optimization, not semantic merge boundaries. Reordering bytes, archives and encrypted files can make block-level combinations corrupt the file." },
        { id: "format-merge", statement: "A format-aware merge can be offered for specific file types while preserving conflict copies as a fallback.", verdict: "holds", explanation: "The application can apply known merge semantics to compatible text or structured documents, but must retain both inputs if the merge is ambiguous or invalid." },
      ] },
      reveal: { takeaways: ["Compare the base revision at commit; do not trust device arrival order.", "Preserve both edits when their semantics are unknown.", "Block boundaries do not imply safe merge boundaries."], reasoning: md`This exercise excludes live collaborative editing. That changes the right design: a file-sync service sees whole versions after offline work, while a collaborative editor needs an operation log and a merge model for concurrent edits. Do not silently borrow one system's consistency contract for the other.` },
      reveals: { components: ["metadata", "database"], flows: ["metadata-ops", "commit"] },
    },
    {
      id: "sharing-and-revocation",
      title: "Sharing is an authorization check on every path",
      phase: "change",
      dimensions: ["trace", "break", "change"],
      conceptIds: ["object-storage", "replication"],
      competencyIds: ["authorization"],
      event: { kind: "requirement-change", title: "A shared-folder member is removed", detail: "The user already has metadata cached and previously received a download URL for a large file." },
      context: md`A file can be reached through a namespace path, a version manifest and many content blocks. Removing a user from the shared folder must not leave a permanent capability to keep downloading those blocks.`,
      lesson: [
        { kind: "read", body: md`Check authorization at the metadata operation and at block retrieval. A signed URL is a bearer capability: anyone who has it can use it until it expires. Short lifetimes reduce revocation delay; proxying reads through an authorization service gives faster revocation but adds bandwidth, cost and a dependency on the hot path.` },
        { kind: "choice", id: "revocation", prompt: "The requirement says revocation takes effect within one minute. What must be true of cached download grants?", options: [
          { id: "long-url", label: "Issue URLs valid for seven days and rely on the client to stop sharing them.", why: "A removed user can keep using the URL for its full lifetime; client behavior is not access control." },
          { id: "short-url", label: "Keep grants under one minute, or proxy block reads through a current authorization check.", correct: true, why: "Either approach bounds the stale permission window to the stated contract, with a clear trade-off between latency/cost and revocation speed." },
          { id: "hidden-hash", label: "Use unpredictable block hashes so a removed user cannot guess new ones.", why: "Unpredictability is not authorization. The user may already know the hashes, and a valid old link remains a capability." },
        ] },
      ],
      interaction: { kind: "open", prompt: "Trace a block download after a user is removed from a shared folder. Name the checks and state the maximum revocation delay your design promises.", rubric: [
        { id: "identity", text: "Authenticates the requesting user and resolves the current namespace membership." },
        { id: "object-access", text: "Checks access to the file or version before returning its block data." },
        { id: "cache-bound", text: "Bounds cached or signed grants to the stated revocation window, or validates each request." },
      ], reference: md`The download path authenticates the user, resolves current access to the file's namespace/version, then reads the requested block. If direct object-store URLs are required, expire them within the one-minute promise and prevent old grants from being refreshed without a new authorization check. A metadata cache can be used only if its invalidation or TTL obeys the same bound.` },
      reveal: { takeaways: ["A content hash is not an access-control check.", "Direct signed links remain usable until expiry; set expiry from the revocation promise.", "Metadata caches and block caches must share the security contract."], reasoning: md`Fast revocation and cheap direct downloads pull in opposite directions. State the allowed delay first. Then choose a bounded signed URL, an authorization-aware edge, or a proxy, and test behavior for cached metadata and already-issued capabilities.` },
      reveals: { components: ["api", "metadata", "blocks"], flows: ["file-ops", "transfer"] },
    },
    {
      id: "deletes-and-reclamation",
      title: "Delete now; reclaim bytes only when safe",
      phase: "defend",
      dimensions: ["explain", "break", "defend"],
      conceptIds: ["object-storage", "transactions"],
      competencyIds: ["storage-reclamation"],
      event: { kind: "scale", title: "Version history and deletes grow the block store", detail: "Users restore old versions, shared files may have several owners, and background cleanup must keep up with daily churn." },
      context: md`Deleting one path may not make its blocks unreachable: another version or another file may reference the same content. A restore can also race with a cleanup job that previously saw no references.`,
      lesson: [
        { kind: "read", body: md`Make delete a metadata operation first: append a tombstone, remove the version from the active namespace, and preserve it for the product's retention window. A collector finds blocks unreachable from all retained manifests, but a stale mark is not permission to delete immediately. Recheck reachability and wait beyond the maximum metadata replication and in-flight upload delay.` },
        { kind: "read", body: md`At large scale, immutable blocks simplify reads and retries but move complexity into reclamation. Garbage collection identifies unreferenced content; compaction is the physical work that makes space reusable. Dropbox's public Magic Pocket posts describe this trade-off in its own storage system; the exercise uses it as an operational lesson, not as a claim that this design matches their implementation.` },
      ],
      interaction: { kind: "claims", prompt: "The collector marked block H unreferenced yesterday. What can it safely do today?", claims: [
        { id: "delete-now", statement: "Delete H immediately because yesterday's reference scan found zero owners.", verdict: "fails", explanation: "A restore, delayed metadata replica or in-flight commit may have made H reachable after the scan. Recheck against current authoritative metadata and honor the safety delay." },
        { id: "retained-history", statement: "Keep H while any retained version manifest still references it, even if the current path was deleted.", verdict: "holds", explanation: "The product's restore window is part of reachability. Expire the version explicitly before its blocks become collectible." },
        { id: "recheck", statement: "Recheck reachability at deletion time and make the delete operation safe to retry.", verdict: "holds", explanation: "The final decision must use current metadata, and an idempotent delete handles worker retry after an uncertain response." },
      ] },
      reveal: { takeaways: ["A user-visible delete is a metadata tombstone; physical reclamation comes later.", "Count all retained manifests and shared references before deleting a block.", "Recheck reachability after the grace period; make cleanup idempotent."], reasoning: md`A clean separation of content and metadata helps this service grow, but it does not make storage free. Version retention, deduplication and garbage collection form one policy: retaining history saves user work and costs capacity; aggressive reclamation saves disks and increases the chance of deleting something users expect to restore. Measure live bytes, unreachable bytes, compaction throughput and restore success together.` },
      reveals: { components: ["gc", "blocks"], flows: ["reclaim"] },
    },
  ],
  synthesis: {
    whyItWorks: md`The service has one mutable control plane and one immutable data plane. Devices send verified blocks to durable storage, then atomically publish a version manifest and append a namespace change. Ordered cursors let online and long-offline clients converge; conditional writes expose concurrent edits; current authorization governs both metadata and block reads; delayed mark-and-sweep reclaims content only after every retained reference is gone.`,
    reliesOn: [
      "Block writes are durable before a manifest can reference them.",
      "A metadata transaction checks the client's expected revision and appends the corresponding journal row atomically.",
      "Devices persist an applied journal cursor and can replay pages idempotently.",
      "Permission checks, cached metadata and download grants obey the same revocation window.",
      "The garbage collector sees every retained manifest and rechecks before deleting blocks.",
    ],
    alternatives: [
      { design: "Whole-file objects with versioned keys", preferWhen: "Files are small, edits usually replace the whole file, and simplicity matters more than bandwidth reuse." },
      { design: "Fixed-size content blocks", preferWhen: "Files are large, transfer resume matters, and edits tend to preserve aligned regions." },
      { design: "Content-defined chunking", preferWhen: "Insertions shift later byte offsets and the storage savings justify more CPU and manifest complexity." },
      { design: "Format-aware merge", preferWhen: "The product owns a structured format with well-defined merge rules; otherwise preserve both versions." },
      { design: "Proxy every block download", preferWhen: "Fast revocation and centralized policy outweigh the extra proxy bandwidth and latency." },
    ],
    tradeoffs: [
      { choice: "Immutable content blocks", gains: "Retryable writes, content reuse and simple integrity checks.", costs: "More metadata and asynchronous garbage collection after deletes or replacement." },
      { choice: "Ordered namespace journal", gains: "Efficient incremental catch-up and one source of truth for changes.", costs: "Cursor retention, pagination and snapshot recovery need explicit contracts." },
      { choice: "Conflict copies for unknown formats", gains: "Avoids silently losing offline work.", costs: "Users may need to resolve duplicate files; byte-level merging is unavailable." },
      { choice: "Short-lived signed downloads", gains: "Efficient direct reads from object storage.", costs: "Revocation is bounded by URL expiry, not instantaneous." },
    ],
    breaksWhen: [
      "The product requires simultaneous character-by-character editing; whole-file version conflicts are no longer an adequate collaboration model.",
      "Very small files dominate so completely that one block and journal row per file overwhelms metadata; batching and a different small-object layout may be needed.",
      "The required revocation time is shorter than the shortest practical signed URL lifetime; reads need a revocable authorization path.",
      "Journal retention is shorter than the longest supported offline period and the service cannot construct a correct snapshot.",
      "Hashing, deduplication or encryption assumptions expose cross-tenant equality or side channels; isolation and threat modeling change the storage key design.",
    ],
  },
  interviewVariants: [
    "Design Dropbox or Google Drive file storage and synchronization.",
    "Design a cloud drive that resumes multi-gigabyte uploads over unreliable networks.",
    "How should a desktop client sync after being offline for several weeks?",
    "How do you handle two devices editing the same file while offline?",
    "Design file sharing with version history, deletion and fast permission revocation.",
  ],
  relatedInvestigationIds: ["video-processing-pipeline", "realtime-collaboration", "shard-live-database"],
} satisfies InvestigationInput;
