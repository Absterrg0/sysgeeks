import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Section } from "@/components/page-header";
import { breadcrumbs, faqPage, jsonLd, pageMetadata } from "@/lib/metadata";
import { SITE_URL } from "@/lib/site";

const PATH = "/system-design-interview/design-youtube";
const TITLE = "Design YouTube: System Design Interview Walkthrough";
const DESCRIPTION =
  "A worked YouTube system design interview answer: resumable uploads, video transcoding, adaptive playback, CDN caching, capacity estimates, and failure handling.";

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

const FAQ = [
  {
    question: "How do you design YouTube in a system design interview?",
    answer:
      "Separate the upload and playback paths. Uploads go directly to durable object storage, then a queue feeds retryable transcoding workers. Publish a video only after its renditions and manifest are verified. Playback reads metadata from a service and streams small adaptive-bitrate segments through a CDN.",
  },
  {
    question: "What is the hardest part of a YouTube system design?",
    answer:
      "The hardest part is balancing two very different workloads: slow, large uploads and asynchronous processing on one side; latency-sensitive playback at very high read volume on the other. Treating both as ordinary API requests creates timeouts, worker backlogs, and expensive origin traffic.",
  },
  {
    question: "Should recommendations be part of the YouTube system design answer?",
    answer:
      "Only if the interviewer asks for them. First establish a reliable video upload and playback service. Search, recommendations, comments, ads, live streaming, and creator analytics are separate systems that can each become a follow-up design problem.",
  },
  {
    question: "Does this describe YouTube's internal architecture?",
    answer:
      "No. It is an interview design exercise with explicit assumptions. The cited Google research describes specific published YouTube systems, but the proposed end-to-end design is not a claim about Google's private production architecture.",
  },
];

export default function DesignYouTubePage() {
  return (
    <article className="measure">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@graph": [
              breadcrumbs([
                { name: "System design interview guide", path: "/system-design-interview" },
                { name: "Design YouTube", path: PATH },
              ]),
              {
                "@type": "Article",
                headline: TITLE,
                description: DESCRIPTION,
                url: `${SITE_URL}${PATH}`,
                mainEntityOfPage: `${SITE_URL}${PATH}`,
                datePublished: "2026-10-11",
                dateModified: "2026-10-11",
                inLanguage: "en",
                author: { "@id": `${SITE_URL}/#organization` },
                publisher: { "@id": `${SITE_URL}/#organization` },
                about: ["YouTube system design", "Video streaming", "System design interview"],
              },
              faqPage(FAQ),
            ],
          }),
        }}
      />

      <PageHeader title="Design YouTube: a system design interview walkthrough" meta="By SysGeeks">
        The strongest answer separates video upload and processing from playback. This walkthrough works through the
        requirements, a capacity estimate, the two request paths, and the failures that change the design. The numbers
        below are interview assumptions, not claims about YouTube&apos;s actual traffic.
      </PageHeader>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/investigations/video-processing-pipeline" className="btn btn-accent">
          Practise upload and processing
        </Link>
        <Link href="/system-design-mock-interview" className="btn btn-secondary">
          Start a timed mock interview
        </Link>
      </div>

      <Section id="scope" title="Clarify the scope before drawing boxes">
        <div className="max-w-[72ch] space-y-4 text-[0.9375rem] leading-relaxed text-ink-2">
          <p>
            Ask whether the prompt is about video on demand or live streaming. For a 45-minute interview, state that
            you will design a user-generated video-on-demand service: creators upload a video, the service prepares
            playable versions, and viewers can start watching from different devices and network speeds.
          </p>
          <p>
            Keep recommendations, search ranking, comments, advertisements, live broadcasts, and copyright review out
            of the first design. They are useful follow-ups, but they should not obscure the core data paths.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Creators can upload large files over an unreliable connection and see processing status.</li>
            <li>Viewers can find a video by its identifier and begin playback quickly.</li>
            <li>Playback adjusts quality as available bandwidth changes.</li>
            <li>A failed upload, worker, storage request, or CDN cache miss has a defined recovery path.</li>
          </ul>
        </div>
      </Section>

      <Section id="estimate" title="Make one estimate that shapes the architecture">
        <div className="max-w-[72ch] space-y-4 text-[0.9375rem] leading-relaxed text-ink-2">
          <p>
            Pick round assumptions and label them. Suppose 10 million viewers each watch 20 minutes per day. That is
            200 million viewing-minutes per day, or about 139,000 average concurrent viewers. At an average delivered
            bitrate of 1.5 Mbps, that is roughly 208 Gbps of average egress. A 3× peak factor gives about 625 Gbps.
          </p>
          <p>
            The exact answer is less important than the consequence: a single application server or storage origin
            cannot serve every segment. Playback needs distributed delivery and caching close to viewers. Use the{" "}
            <Link href="/capacity-estimator" className="link">capacity estimator</Link> to change the assumptions and
            see how the estimate moves.
          </p>
        </div>
      </Section>

      <Section id="architecture" title="A defensible high-level design">
        <ol className="max-w-[72ch] divide-y divide-rule border-y border-rule">
          {[
            ["Upload API", "Authenticates the creator, creates an upload session, reserves metadata, and returns short-lived upload URLs. It carries control messages, not gigabytes of video."],
            ["Object storage", "Accepts resumable or multipart uploads directly from the client and stores the original file durably."],
            ["Metadata database and job queue", "Records the video state and schedules processing. Commit the state change and job publication atomically, using an outbox or equivalent mechanism."],
            ["Transcoding workers", "Claim jobs with expiring leases, produce several codec and resolution renditions, validate the outputs, and retry safely after crashes."],
            ["Manifest and segment storage", "Stores immutable media segments and a manifest that lists playable renditions. Publish the manifest only after every required object is present."],
            ["Playback API and CDN", "The API authorizes playback and returns metadata or a manifest URL. The player fetches segments from a CDN; the origin serves cache misses."],
          ].map(([title, text], i) => (
            <li key={title} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 py-4">
              <span className="pt-0.5 font-heading text-[1.125rem] text-ink-3 tabular-nums">{i + 1}</span>
              <div>
                <h3 className="text-[0.9375rem] font-medium">{title}</h3>
                <p className="mt-1 text-[0.9375rem] leading-relaxed text-ink-2">{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="upload" title="Upload path: move bytes once, recover from interruption">
        <div className="max-w-[72ch] space-y-4 text-[0.9375rem] leading-relaxed text-ink-2">
          <p>
            The browser asks the API to start an upload. The API creates a video record in <code>uploading</code> state
            and returns a scoped session. The browser then transfers chunks directly to object storage. If the
            connection drops, it asks which byte range arrived and resumes from there. Google&apos;s public YouTube Data
            API documents this resumable upload pattern; it is useful evidence for the interaction, not a description
            of YouTube&apos;s internal storage stack.
          </p>
          <p>
            When storage confirms the upload, the API records <code>processing</code> and enqueues a job. A worker
            writes each attempt under a unique output prefix, so a retry cannot overwrite a successful attempt. It
            validates the renditions and manifest before a conditional database update changes the video to
            <code>ready</code>. That update is the publish point.
          </p>
          <p>
            Make processing at-least-once and the effects idempotent. A lease lets another worker retry after a crash;
            a fencing token prevents the old worker from publishing after its lease expired. A reconciler finds
            abandoned uploads and output objects that no published video references.
          </p>
        </div>
      </Section>

      <Section id="playback" title="Playback path: keep the origin away from the hot path">
        <div className="max-w-[72ch] space-y-4 text-[0.9375rem] leading-relaxed text-ink-2">
          <p>
            The player requests a video manifest, chooses a rendition, and fetches short segments over HTTP. It can
            switch to a lower or higher bitrate as measured throughput and buffer health change. A CDN caches popular
            immutable segments near viewers; the metadata API remains small and separate from the media bytes.
          </p>
          <p>
            This cache is a capacity and correctness boundary. A popular video can create a hot object, so cache
            placement, eviction, and request coalescing affect origin load. Google&apos;s published HALP paper describes
            an eviction algorithm deployed in YouTube&apos;s CDN. The authors report an average 9.1% reduction in byte
            misses during peak, with 1.8% CPU overhead. That is a concrete example of cache policy being a production
            design problem, not just a box on a diagram.
          </p>
          <p>
            The exact streaming protocol is a design choice. Apple&apos;s HLS documentation describes delivery through
            ordinary web servers and CDNs, with multiple bitrate streams and switching as network conditions change.
            In an interview, explain the manifest and segment flow, then name the trade-off between startup delay,
            segment size, bitrate efficiency, and cacheability.
          </p>
        </div>
      </Section>

      <Section id="failures" title="Failures that expose whether the design is complete">
        <dl className="max-w-[72ch] divide-y divide-rule border-y border-rule">
          {[
            ["The client loses its connection mid-upload", "Resume from the acknowledged byte range. Expire abandoned sessions and clean up incomplete multipart data."],
            ["A transcoder crashes after writing some renditions", "Let the lease expire, retry under a new attempt prefix, and publish only after validation. Never infer readiness from a worker heartbeat."],
            ["The queue is healthy but processing falls behind", "Measure oldest-job age and estimated work, not only queue depth. Scale workers against CPU capacity and apply admission limits if backlog threatens the ready-time objective."],
            ["A viral video causes an origin spike", "Cache immutable segments at the edge, collapse concurrent misses where possible, and pre-warm only when popularity is predictable enough to justify the cost."],
            ["A creator deletes a video while it is processing", "Use a terminal deleted state and conditional transitions. Stop or ignore later worker completion, then remove raw and derived objects asynchronously."],
            ["A manifest is visible before one segment is available", "Treat manifest publication as the final atomic step. Keep incomplete attempts private and serve only a manifest whose referenced objects passed validation."],
          ].map(([failure, response]) => (
            <div key={failure} className="grid gap-x-6 gap-y-1 py-3 sm:grid-cols-[15rem_minmax(0,1fr)]">
              <dt className="text-[0.9375rem] font-medium">{failure}</dt>
              <dd className="text-[0.9375rem] leading-relaxed text-ink-2">{response}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section id="answer" title="A concise interview answer">
        <blockquote className="max-w-[72ch] border-l-2 border-rule pl-5 text-[0.9375rem] leading-relaxed text-ink-2">
          <p>
            “I&apos;ll design on-demand uploads and playback first. Clients upload resumably to object storage, while a
            durable job queue feeds retryable transcoders. A video becomes visible only after all required renditions
            and its manifest are verified. Playback uses a small metadata API and adaptive segments served through a
            CDN. I&apos;ll size the egress path first, then check worker backlog and storage growth. The main correctness
            boundary is publication: retries may duplicate compute, but only one validated attempt can become ready.”
          </p>
        </blockquote>
        <p className="mt-4 max-w-[72ch] text-[0.9375rem] leading-relaxed text-ink-2">
          Then invite the interviewer to choose a follow-up: live streaming, recommendation feeds, search, copyright
          review, or the economics of storing every rendition. Do not add those subsystems before the core flows work.
        </p>
      </Section>

      <Section id="sources" title="Published sources and scope">
        <ul className="max-w-[72ch] list-disc space-y-2 pl-5 text-[0.9375rem] leading-relaxed text-ink-2">
          <li>
            <a className="link" href="https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol">
              YouTube Data API: Resumable Uploads
            </a>{" "}
            documents how a client resumes after interrupted video uploads.
          </li>
          <li>
            <a className="link" href="https://research.google/pubs/halp-heuristic-aided-learned-preference-eviction-policy-for-youtube-content-delivery-network/">
              Google Research: HALP for YouTube&apos;s CDN
            </a>{" "}
            describes one published cache-eviction system and its production evaluation.
          </li>
          <li>
            <a className="link" href="https://developer.apple.com/documentation/http-live-streaming">
              Apple Developer: HTTP Live Streaming
            </a>{" "}
            explains adaptive delivery of multiple bitrate streams over ordinary web infrastructure.
          </li>
        </ul>
        <p className="mt-4 max-w-[72ch] text-[0.8125rem] leading-relaxed text-ink-3">
          This is an original interview exercise, not an account of private YouTube internals. The public sources above
          support specific mechanisms; the workload numbers and end-to-end design are stated assumptions for practice.
        </p>
      </Section>

      <Section id="faq" title="YouTube system design interview questions">
        <dl className="max-w-[72ch] divide-y divide-rule border-y border-rule">
          {FAQ.map(({ question, answer }) => (
            <div key={question} className="py-4">
              <dt className="font-medium">{question}</dt>
              <dd className="mt-1 text-[0.9375rem] leading-relaxed text-ink-2">{answer}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <section aria-label="Continue practising" className="section border-t border-rule">
        <p className="max-w-[60ch] font-display text-[1.375rem] leading-snug">
          The most useful next step is to defend the upload path when a worker dies halfway through a job.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href="/investigations/video-processing-pipeline" className="btn btn-primary">
            Practise the video processing pipeline
          </Link>
          <Link href="/system-design-interview" className="btn btn-secondary">
            Back to the interview guide
          </Link>
        </div>
      </section>
    </article>
  );
}
