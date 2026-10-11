import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Section } from "@/components/page-header";
import { breadcrumbs, faqPage, jsonLd, pageMetadata } from "@/lib/metadata";
import { SITE_NAME, SITE_URL } from "@/lib/site";

const PATH = "/system-design-interview/design-instagram-feed";
const TITLE = "Instagram Feed System Design Interview: Worked Guide";
const DESCRIPTION =
  "A source-based Instagram feed system design interview walkthrough. Separate followed posts from recommendations, generate candidates, rank in stages, and handle celebrity fan-out.";

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

const FAQ = [
  {
    question: "How do you design an Instagram feed in a system design interview?",
    answer:
      "Start by defining whether the prompt covers posts from followed accounts, recommended posts, or both. Build candidate sources for each, filter candidates against current privacy and deletion state, rank a manageable set in stages, and hydrate the selected posts for the client. State the latency, freshness, and ranking assumptions before choosing fan-out or read-time work.",
  },
  {
    question: "How do you handle an account with millions of followers?",
    answer:
      "Fan out ordinary authors' post IDs asynchronously to active followers, but do not synchronously write a celebrity's post into every follower's timeline. Merge recent posts from very large accounts at read time or use a hybrid threshold. This caps write amplification while keeping the common read path short.",
  },
  {
    question: "Is this Instagram's actual feed architecture?",
    answer:
      "No. This is a system design interview proposal, not a description of Instagram's private production system. It uses patterns described in public Meta Engineering articles and marks additional choices as interview assumptions.",
  },
  {
    question: "How is a home feed different from Explore?",
    answer:
      "A home feed starts with sources a person chose to follow. Explore starts with candidates inferred from activity and other recommendation sources. Keep those candidate sources distinct, then apply shared filtering, ranking, and diversity steps where the product requires them.",
  },
];

const READ_PATH_NODES = [
  { x: 24, title: "Viewer", detail: "feed request + cursor" },
  { x: 190, title: "Feed API", detail: "authorize + start read" },
  { x: 356, title: "Candidate merge", detail: "followed + suggested" },
  { x: 522, title: "Eligibility", detail: "privacy + deletions" },
  { x: 688, title: "Staged ranking", detail: "shortlist → deeper rank" },
  { x: 854, title: "Hydrate + paginate", detail: "post data + media URLs" },
  { x: 1020, title: "Feed page", detail: "ordered items + cursor" },
];

const WRITE_PATH_NODES = [
  { x: 24, title: "Publish post", detail: "store before delivery" },
  { x: 190, title: "Post store", detail: "source of truth" },
  { x: 356, title: "Durable queue", detail: "retryable fan-out job" },
  { x: 522, title: "Fan-out workers", detail: "active followers only" },
  { x: 688, title: "Timeline cache", detail: "derived post IDs" },
];

function DiagramNode({ x, y, title, detail }: { x: number; y: number; title: string; detail: string }) {
  const width = 136;
  const center = x + width / 2;
  return (
    <g>
      <rect x={x} y={y} width={width} height="74" rx="9" fill="var(--raised)" stroke="var(--rule-strong)" />
      <text x={center} y={y + 29} textAnchor="middle" fill="var(--ink)" fontSize="13" fontWeight="600">
        {title}
      </text>
      <text x={center} y={y + 51} textAnchor="middle" fill="var(--ink-2)" fontSize="10.5">
        {detail}
      </text>
    </g>
  );
}

function InstagramFeedDiagram() {
  return (
    <figure
      className="screen relative left-1/2 mt-6 w-screen max-w-[76rem] -translate-x-1/2 overflow-hidden p-4 sm:p-6"
      aria-labelledby="feed-diagram-caption"
    >
      <div className="overflow-x-auto">
        <svg
          viewBox="0 0 1180 500"
          className="h-auto min-w-[68rem] w-full"
          role="img"
          aria-labelledby="instagram-feed-diagram-title instagram-feed-diagram-desc"
        >
          <title id="instagram-feed-diagram-title">Instagram home feed system design</title>
          <desc id="instagram-feed-diagram-desc">
            The read path merges followed and recommended candidates, checks privacy and deletion state, ranks in
            stages, then hydrates and paginates posts. A separate asynchronous write path fans new post IDs out to
            active followers, while the post store remains the source of truth.
          </desc>
          <defs>
            <marker id="instagram-feed-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M 0 1 L 9 5 L 0 9 z" fill="var(--ink-3)" />
            </marker>
          </defs>
          <text x="24" y="30" fill="var(--ink-3)" fontSize="11" fontWeight="600" letterSpacing="1.2">
            READ PATH · BUILD A PAGE FROM CANDIDATES
          </text>
          {READ_PATH_NODES.map((node, index) => (
            <g key={node.title}>
              {index < READ_PATH_NODES.length - 1 && (
                <line
                  x1={node.x + 138}
                  y1="91"
                  x2={READ_PATH_NODES[index + 1]!.x - 5}
                  y2="91"
                  stroke="var(--ink-3)"
                  strokeWidth="1.5"
                  markerEnd="url(#instagram-feed-arrow)"
                />
              )}
              <DiagramNode x={node.x} y={54} title={node.title} detail={node.detail} />
            </g>
          ))}
          <path
            d="M 345 200 C 345 170, 390 162, 390 128"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="1.5"
            markerEnd="url(#instagram-feed-arrow)"
          />
          <path
            d="M 565 200 C 565 170, 458 162, 458 128"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="1.5"
            markerEnd="url(#instagram-feed-arrow)"
          />
          <DiagramNode x={250} y={200} title="Followed accounts" detail="graph + recent timelines" />
          <DiagramNode x={482} y={200} title="Recommendations" detail="retrieval from activity" />

          <text x="24" y="342" fill="var(--ink-3)" fontSize="11" fontWeight="600" letterSpacing="1.2">
            WRITE PATH · KEEP PUBLISHING INDEPENDENT OF DELIVERY
          </text>
          {WRITE_PATH_NODES.map((node, index) => (
            <g key={node.title}>
              {index < WRITE_PATH_NODES.length - 1 && (
                <line
                  x1={node.x + 138}
                  y1="403"
                  x2={WRITE_PATH_NODES[index + 1]!.x - 5}
                  y2="403"
                  stroke="var(--ink-3)"
                  strokeWidth="1.5"
                  strokeDasharray="5 4"
                  markerEnd="url(#instagram-feed-arrow)"
                />
              )}
              <DiagramNode x={node.x} y={366} title={node.title} detail={node.detail} />
            </g>
          ))}
          <path
            d="M 756 366 V 316 H 345 V 274"
            fill="none"
            stroke="var(--ink-3)"
            strokeWidth="1.5"
            strokeDasharray="5 4"
            markerEnd="url(#instagram-feed-arrow)"
          />
          <rect x="450" y="301" width="206" height="26" rx="6" fill="var(--paper)" />
          <text x="553" y="318" textAnchor="middle" fill="var(--ink-2)" fontSize="10.5">
            precompute active followers; merge huge accounts at read time
          </text>
        </svg>
      </div>
      <figcaption id="feed-diagram-caption" className="mt-4 text-[0.8125rem] leading-relaxed text-ink-2">
        Keep candidate sources separate. The read path filters and ranks them; the write path prepares follower
        timelines asynchronously, while the post store remains authoritative.
      </figcaption>
    </figure>
  );
}

export default function DesignInstagramFeedPage() {
  return (
    <article className="measure">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@graph": [
              breadcrumbs([
                { name: "System design interview guide", path: "/system-design-interview" },
                { name: "Instagram feed system design", path: PATH },
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
                about: ["Instagram feed system design", "System design interview", "News feed ranking"],
              },
              faqPage(FAQ),
            ],
          }),
        }}
      />

      <PageHeader title="Instagram feed system design interview: a worked guide">
        Design a home feed for photo and video posts. The hard part is deciding which posts to consider, how to rank
        them within a latency budget, and how to keep a very large author from multiplying work without limit. This is
        an interview proposal based on public engineering sources, not a claim about Instagram&apos;s private
        implementation.
      </PageHeader>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/investigations/news-feed" className="btn btn-accent">
          Practise the interactive news feed question
        </Link>
        <Link href="/system-design-interview" className="btn btn-secondary">
          Read the 45-minute interview plan
        </Link>
      </div>

      <Section id="scope" title="Clarify what the prompt means by feed">
        <div className="max-w-[72ch] space-y-4 text-[0.9375rem] leading-relaxed text-ink-2">
          <p>
            Ask whether the feed contains only posts from followed accounts, or also recommendations from accounts the
            viewer does not follow. Meta has described these as different candidate sources: Home Feed uses accounts a
            person chose to follow, while Explore and suggested posts can use inferred interests. The product may
            combine them in one screen, but the design should keep their retrieval paths explicit. Read Meta&apos;s
            explanation of <a className="link" href="https://engineering.fb.com/2020/12/10/web/how-instagram-suggests-new-content/">how Instagram suggests new content</a>.
          </p>
          <p>
            For this exercise, assume people can publish a photo or video, follow accounts, and load a personalized,
            paginated home feed. Include recommendations only if the interviewer asks for them. Treat comments,
            messaging, Stories, and video transcoding as separate systems unless the prompt adds them.
          </p>
          <p>
            Ask the interviewer to set targets for first-page latency, how soon a new post should appear, and how much
            ranking quality can cost. Do not invent Instagram&apos;s traffic or service-level numbers. Use the agreed
            targets to choose the amount of precomputation and ranking work.
          </p>
        </div>
      </Section>

      <Section id="architecture" title="A practical feed architecture">
        <InstagramFeedDiagram />
        <ol className="max-w-[72ch] divide-y divide-rule border-y border-rule">
          <li className="py-4">
            <h3 className="text-[0.9375rem] font-medium">1. Store the post and media separately</h3>
            <p className="mt-1 text-[0.9375rem] leading-relaxed text-ink-2">
              Upload media to object storage, then save a post record and a fan-out event in the same transaction.
              Store the author, media key, visibility, creation time, and processing state. The post record remains
              the source of truth. Feed entries refer to post IDs instead of copying captions or media.
            </p>
          </li>
          <li className="py-4">
            <h3 className="text-[0.9375rem] font-medium">2. Build candidate sources</h3>
            <p className="mt-1 text-[0.9375rem] leading-relaxed text-ink-2">
              Fetch recent posts from followed accounts. If the prompt includes recommended posts, add a separate
              source for those candidates. Merge and deduplicate the candidate IDs before ranking. This keeps the
              connected follow graph distinct from recommendations based on viewing and interaction history.
            </p>
          </li>
          <li className="py-4">
            <h3 className="text-[0.9375rem] font-medium">3. Keep fan-out bounded</h3>
            <p className="mt-1 text-[0.9375rem] leading-relaxed text-ink-2">
              For ordinary accounts, process the durable fan-out event and write the post ID into active followers&apos;
              timeline candidate lists. Skip inactive followers. For accounts above a follower threshold, merge recent
              posts at read time instead of writing to millions of timelines. The threshold is an interview parameter,
              not a public Instagram constant. The existing <Link href="/investigations/news-feed" className="link">Twitter timeline exercise</Link>
              works through the read/write trade-off with figures from Twitter&apos;s published system in 2012 and 2013.
            </p>
          </li>
          <li className="py-4">
            <h3 className="text-[0.9375rem] font-medium">4. Rank in stages</h3>
            <p className="mt-1 text-[0.9375rem] leading-relaxed text-ink-2">
              Check visibility and policy first, then apply a lightweight ranker to the remaining candidates. Run more
              expensive ranking on a smaller shortlist, then apply freshness and diversity rules. Recheck privacy and
              deletion state before returning the page. Meta describes retrieval, early ranking, and later ranking layers for Instagram
              recommendation surfaces in its article about <a className="link" href="https://engineering.fb.com/2025/05/21/production-engineering/journey-to-1000-models-scaling-instagrams-recommendation-system/">scaling Instagram&apos;s recommendation system</a>.
              Do not assume every surface uses the same model or pipeline.
            </p>
          </li>
          <li className="py-4">
            <h3 className="text-[0.9375rem] font-medium">5. Hydrate and paginate</h3>
            <p className="mt-1 text-[0.9375rem] leading-relaxed text-ink-2">
              Fetch post metadata for the ranked IDs, attach media delivery URLs, and return a stable cursor. Recheck
              visibility and deletion when hydrating so stale candidate lists do not expose content that is no longer
              available. Use a cursor tied to the last returned ordering key rather than an offset that shifts as new
              posts arrive.
            </p>
          </li>
          <li className="py-4">
            <h3 className="text-[0.9375rem] font-medium">6. Measure more than clicks</h3>
            <p className="mt-1 text-[0.9375rem] leading-relaxed text-ink-2">
              Track whether people hide or report a post, whether they see repeated authors, and whether the feed
              remains fresh. A ranking objective should balance useful interactions with negative feedback and
              integrity constraints. A click-only score can reward content that viewers quickly regret opening.
            </p>
          </li>
        </ol>
      </Section>

      <Section id="tradeoffs" title="Decisions to explain in the interview">
        <div className="max-w-[72ch] space-y-4 text-[0.9375rem] leading-relaxed text-ink-2">
          <p>
            Start with a chronological feed if the prompt does not require recommendations. It is easier to explain
            and gives you a baseline. Add ranking when the requirements say the product should order by relevance or
            mix in suggested posts. Meta&apos;s public article on Instagram Explore describes retrieval and multiple
            ranking stages for Explore specifically. Use it as evidence for a staged design pattern, not as proof
            that Home Feed uses the same implementation: <a className="link" href="https://engineering.fb.com/2023/08/09/ml-applications/scaling-instagram-explore-recommendations-system/">Instagram Explore recommendation design</a>.
          </p>
          <p>
            Fan-out on write makes common reads cheap, but multiplies each post by its audience size. Fan-out on read
            makes publishing cheap, but asks every reader to fetch and merge many authors. A hybrid handles the
            long-tail of very large accounts. These are trade-offs to calculate from the prompt, not universal rules.
          </p>
          <p>
            Treat the feed cache as derived data. The post store owns the content, and the follow graph owns the
            relationships. If a worker fails, a durable queue can retry fan-out; idempotent inserts prevent duplicates.
            If a ranker times out, return a bounded fallback such as recent followed posts instead of holding the
            entire page open.
          </p>
        </div>
      </Section>

      <Section id="45-minutes" title="A 45-minute answer outline">
        <ol className="max-w-[72ch] divide-y divide-rule border-y border-rule">
          <li className="py-3">
            <strong className="font-medium">Minutes 0 to 5.</strong> Clarify home feed scope, recommendations, privacy, pagination, latency, and freshness.
          </li>
          <li className="py-3">
            <strong className="font-medium">Minutes 5 to 10.</strong> Estimate the read/write ratio from interviewer-provided rates and choose what to precompute.
          </li>
          <li className="py-3">
            <strong className="font-medium">Minutes 10 to 20.</strong> Draw post storage, follow graph, candidate sources, fan-out workers, and feed service.
          </li>
          <li className="py-3">
            <strong className="font-medium">Minutes 20 to 35.</strong> Deep dive on ranking stages, large accounts, pagination, and privacy or deletion checks.
          </li>
          <li className="py-3">
            <strong className="font-medium">Minutes 35 to 45.</strong> Walk through worker failures, stale candidates, ranker timeouts, and a change in the latency target.
          </li>
        </ol>
      </Section>

      <Section id="faq" title="Instagram feed system design questions">
        <dl className="max-w-[72ch] divide-y divide-rule border-y border-rule">
          {FAQ.map(({ question, answer }) => (
            <div key={question} className="py-4">
              <dt className="font-medium">{question}</dt>
              <dd className="mt-1 text-[0.9375rem] leading-relaxed text-ink-2">{answer}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <p className="max-w-[72ch] border-t border-rule pt-6 text-[0.8125rem] leading-relaxed text-ink-3">
        Sources describe public engineering work from Meta. The proposed design is an interview exercise, and it does
        not reproduce Instagram&apos;s private system. More practice: <Link href="/investigations" className="link">system design questions and worked answers</Link>.
        {" "}By {SITE_NAME}.
      </p>
    </article>
  );
}
