import type { Metadata } from "next";
import Link from "next/link";
import { ContentUsefulness } from "@/components/content-usefulness";
import { PageHeader, Section } from "@/components/page-header";
import { breadcrumbs, faqPage, jsonLd, pageMetadata } from "@/lib/metadata";
import { SITE_URL } from "@/lib/site";

const PATH = "/system-design-interview/design-rag-system";
const TITLE = "RAG System Design Interview: Retrieval, LLMs & Failure Modes";
const DESCRIPTION =
  "Design a RAG system for a system design interview: private documents, hybrid retrieval, grounded LLM answers, access control, freshness, and failure handling.";

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

const FAQ = [
  {
    question: "How do you design a RAG system in a system design interview?",
    answer:
      "Start with the answer contract, corpus size, freshness target, latency, and access rules. Separate document ingestion from query serving. Version and chunk source documents, attach authorization metadata, retrieve candidates using lexical and semantic search, optionally rerank them, then generate only from authorized evidence with citations or abstention. Measure retrieval quality and grounded answer quality separately.",
  },
  {
    question: "How should a RAG system enforce document permissions?",
    answer:
      "Derive the user and tenant scope from a trusted identity, apply that scope inside the retrieval service before documents enter the prompt, and recheck authorization before returning citations. Do not trust a client-supplied tenant filter or rely on the language model to hide unauthorized text.",
  },
  {
    question: "Does retrieval-augmented generation prevent hallucinations?",
    answer:
      "No. Retrieved context can be stale, irrelevant, incomplete, or wrong, and a model can still make unsupported claims. Return source-linked citations, measure whether claims are supported, and abstain when evidence is missing or conflicting.",
  },
  {
    question: "How do you keep RAG answers fresh when documents change?",
    answer:
      "Track immutable document versions and indexing state. Process updates idempotently, publish a new version only after its chunks are indexed, and make the old version unavailable after the switch. Deletions and permission revocations must invalidate retrieval and caches promptly.",
  },
  {
    question: "Can I practise this design on SysGeeks?",
    answer:
      "Start with the four follow-up drills on this page, then use a timed system design mock interview to rehearse the full answer. Focus on scope, retrieval trade-offs, access boundaries, and failure handling.",
  },
];

export default function DesignRagSystemPage() {
  return (
    <article className="measure">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@graph": [
              breadcrumbs([
                { name: "System design interview guide", path: "/system-design-interview" },
                { name: "Design a RAG system", path: PATH },
              ]),
              {
                "@type": "Article",
                headline: TITLE,
                description: DESCRIPTION,
                url: SITE_URL + PATH,
                mainEntityOfPage: SITE_URL + PATH,
                datePublished: "2026-10-11",
                dateModified: "2026-10-13",
                inLanguage: "en",
                author: { "@id": SITE_URL + "/#organization" },
                publisher: { "@id": SITE_URL + "/#organization" },
                about: ["Retrieval-augmented generation", "RAG system design", "System design interview"],
              },
              faqPage(FAQ),
            ],
          }),
        }}
      />

      <PageHeader title="Design a RAG system with LLMs: a system design interview walkthrough" meta="By SysGeeks">
        Design a retrieval-augmented generation (RAG) service that uses a large language model (LLM) to answer questions
        over private, changing documents. The hard parts are keeping retrieval
        inside the caller&apos;s permissions, publishing updates without mixed versions, and showing when the evidence
        does not support an answer. This is an interview design with explicit assumptions, not a claim about any
        provider&apos;s private architecture.
      </PageHeader>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/system-design-mock-interview" className="btn btn-accent">
          Practise in a timed mock interview
        </Link>
        <Link href="/system-design-interview/design-llm-inference" className="btn btn-secondary">
          Design the LLM serving layer
        </Link>
      </div>

      <Section id="scope" title="Define what a useful answer must guarantee">
        <div className="max-w-[72ch] space-y-4 text-[0.9375rem] leading-relaxed text-ink-2">
          <p>
            Assume employees ask questions about internal policies, product documentation, and support tickets. The
            system returns a short answer with links to supporting passages. Before choosing a vector database, agree
            on the contract:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Users see only documents their current identity is allowed to read.</li>
            <li>Answers cite the source passages; when evidence is weak or conflicting, the system says so.</li>
            <li>Document edits, deletions, and permission changes become effective within an agreed freshness window.</li>
            <li>Ordinary text questions meet a stated latency target, including retrieval and generation.</li>
          </ul>
          <p>
            Ask about corpus size, document formats, update and deletion rates, tenant count, query rate, languages,
            access-control rules, answer length, and the cost and latency budget. For this walkthrough, assume 10
            million documents, about 2,000 tokens per document, mostly English text, and an explicitly versioned
            corpus. These are example inputs for reasoning, not universal sizing values.
          </p>
        </div>
      </Section>

      <Section id="architecture" title="Separate ingestion from query serving">
        <p className="max-w-[72ch] text-[0.9375rem] leading-relaxed text-ink-2">
          Keep two paths. Ingestion converts source changes into a searchable, authorized index. Query serving
          authenticates the caller, retrieves evidence within that scope, and generates a cited answer. They share
          versioned document and permission metadata, but a slow embedding job should not block reads from the
          currently active index.
        </p>
        <ol className="mt-5 max-w-[72ch] divide-y divide-rule border-y border-rule">
          {[
            ["Source connectors", "Read document changes and tombstones from authoritative systems. Attach a stable source ID and source version."],
            ["Ingestion workers", "Parse and normalize content, preserve section boundaries, split it into chunks, and attach document, version, tenant, and access metadata."],
            ["Index builder", "Generate embeddings in batches, write lexical and vector indexes, and record a durable status for every source version."],
            ["Version publisher", "Make a new document version active only after all required chunks are queryable; retire the previous version as one logical change."],
            ["Query API", "Authenticate the user, derive the permitted tenant and document scope, and enforce that scope before constructing model context."],
            ["Retriever and reranker", "Combine semantic and lexical candidates when the corpus needs both, then spend extra ranking work only on the smaller candidate set."],
            ["Answer service", "Send bounded, authorized passages to the model, validate returned citation IDs, and return source links or an abstention."],
          ].map(([name, detail], index) => (
            <li key={name} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 py-4">
              <span className="pt-0.5 font-heading text-[1.125rem] text-ink-3 tabular-nums">{index + 1}</span>
              <div>
                <h3 className="text-[0.9375rem] font-medium">{name}</h3>
                <p className="mt-1 text-[0.9375rem] leading-relaxed text-ink-2">{detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="ingestion" title="Make document updates safe to retry">
        <div className="max-w-[72ch] space-y-4 text-[0.9375rem] leading-relaxed text-ink-2">
          <p>
            Treat indexing as a versioned state transition, not a series of unrelated vector writes. A useful
            idempotency key is the source, document, and source version together. A retry for that identity must not
            create a second logical copy. Store chunk IDs that include the document version, plus the source URI and
            section path needed to build citations.
          </p>
          <ol className="list-decimal space-y-2 pl-5">
            <li>Record the observed source version and enqueue it durably.</li>
            <li>Parse, normalize, and chunk the content while preserving headings and other useful boundaries.</li>
            <li>Write chunks and metadata to a pending version; retry failed batches without exposing partial content.</li>
            <li>Verify the expected chunks are indexed, then atomically switch the active-version pointer.</li>
            <li>Remove the old version and invalidate affected caches after the switch.</li>
          </ol>
          <p>
            Deletion is its own indexed operation. A tombstone should prevent a lagging connector or retry from
            resurrecting deleted content. If the source system revokes a user&apos;s permission, the query path must
            stop returning the document before a slower full re-embedding job completes.
          </p>
        </div>
      </Section>

      <Section id="retrieval" title="Retrieve evidence before asking the model">
        <div className="max-w-[72ch] space-y-4 text-[0.9375rem] leading-relaxed text-ink-2">
          <p>
            First derive an authorization scope from the verified identity. Apply it in the retrieval service, not in
            a browser parameter and not as an instruction to the language model. Check returned document IDs against
            that scope again before passing text to the model. A model cannot repair a permission leak after private
            text is already in its context.
          </p>
          <p>
            For the baseline, embed the query and find nearby chunks, with metadata filters for tenant, document
            version, and access scope. Semantic retrieval handles paraphrases; lexical retrieval can rescue exact names,
            error codes, and policy terms that embeddings rank poorly. If evaluation shows the combination helps, merge
            the candidate lists, rerank a small set against the original query, then pass only the best passages within
            a fixed token budget. Reranking improves ordering; it cannot recover evidence the first-stage retriever
            never found.
          </p>
          <p>
            Do not choose chunk size by habit. Test different boundaries against representative questions. Small
            chunks sharpen matches but can lose context; large chunks preserve context but consume more prompt tokens
            and may dilute relevance. Keep stable source IDs and offsets so citations still point to the exact passage
            after ranking.
          </p>
          <p>
            In multi-turn conversations, resolve references such as “that policy” into a search query, but keep the
            original user question for answer generation. Query rewriting is an optimization to measure; it is not a
            substitute for retrieval evaluation.
          </p>
        </div>
      </Section>

      <Section id="capacity" title="Estimate index size before choosing a store">
        <div className="max-w-[72ch] space-y-4 text-[0.9375rem] leading-relaxed text-ink-2">
          <p>
            With the example assumptions, 10 million documents at 2,000 tokens each contain about 20 billion source
            tokens. At roughly 200 tokens per chunk, that is about 100 million chunks before overlap, metadata, or
            replicas. If an embedding has 1,536 dimensions stored at two bytes per dimension, its raw vector is about
            3 KB; 100 million such vectors are roughly 300 GB of raw vector values alone.
          </p>
          <p>
            This is a lower-bound illustration, not a storage quote. Chunk overlap increases vector count; the ANN
            structure, text index, metadata, source copies, and replication add storage. Measure the actual embedding
            dimensions, index implementation, compression, and recall target. Then compare the cost of a managed vector
            service with a relational or search engine that can also handle the required filtering and lexical search.
          </p>
          <p>
            Query capacity has a different shape: count searches per second, candidates returned per query, rerank
            calls, prompt tokens, generated tokens, and their p95 latency. Use the{" "}
            <Link href="/capacity-estimator" className="link">capacity estimator</Link> for request, storage, and
            network arithmetic; benchmark embeddings, retrieval, reranking, and generation on the chosen workload.
          </p>
        </div>
      </Section>

      <Section id="failures" title="Trace the failures that change the design">
        <dl className="max-w-[72ch] divide-y divide-rule border-y border-rule">
          {[
            ["A document update is only partly indexed", "Keep the new version pending and continue serving the prior complete version. Alert on indexing age; never publish a partial set as current."],
            ["A user loses access after a result was cached", "Recheck authorization before returning answer text and citation links. Include the permission version in cache keys, or bypass shared answer caches when permissions cannot be represented safely."],
            ["A deleted document returns in search", "Propagate a tombstone keyed by source and document version. Make connector checkpoints and retries respect the tombstone, and test deletion against both lexical and vector indexes."],
            ["Retrieval finds no adequate evidence", "Return a clear abstention or ask a clarifying question. Do not let the model fill the gap from general training data while presenting the answer as document-backed."],
            ["Two current sources disagree", "Return both citations and state the conflict, or prefer an explicitly authoritative and newer source if the product contract defines that policy. Do not silently collapse the disagreement."],
            ["The embedding or model provider is slow", "Bound retries and queues separately for ingestion and query traffic. Keep reads on the active index during ingestion delays; apply a timeout or a documented degraded response to queries."],
          ].map(([failure, response]) => (
            <div key={failure} className="py-4">
              <dt className="font-medium">{failure}</dt>
              <dd className="mt-1 text-[0.9375rem] leading-relaxed text-ink-2">{response}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section id="evaluation" title="Evaluate retrieval and answers separately">
        <div className="max-w-[72ch] space-y-4 text-[0.9375rem] leading-relaxed text-ink-2">
          <p>
            Build a versioned test set from real question shapes, expected source passages, permission scopes, and
            expected abstentions. Evaluate retrieval before generation: recall at k asks whether required evidence
            appears in the retrieved set; precision and ranking metrics show how much irrelevant context is included
            and where it appears. Slice results by document type, tenant, query length, and update age.
          </p>
          <p>
            Evaluate answers separately for claim support, correctness against a trusted reference, citation accuracy,
            and appropriate abstention. Include adversarial access tests: a user must not retrieve a document by guessing
            its title, URL, ID, or another tenant&apos;s metadata. Track p50 and p95 latency and cost for each stage, so
            retrieval regressions are distinguishable from model delays. A high answer score cannot compensate for a
            permission failure.
          </p>
          <p>
            The{" "}
            <a className="link" href="https://docs.cohere.com/page/rag-evaluation-deep-dive">Cohere RAG evaluation guide</a>{" "}
            separates retrieval metrics from claim-level generation checks. The{" "}
            <a className="link" href="https://docs.cohere.com/docs/retrieval-augmented-generation-rag">Cohere RAG documentation</a>{" "}
            also notes that retrieved material can itself be outdated or wrong, so grounding does not guarantee a
            correct answer.
          </p>
        </div>
      </Section>

      <Section id="answer" title="A concise interview answer">
        <blockquote className="max-w-[72ch] border-l-2 border-accent pl-5 text-[0.9375rem] leading-relaxed text-ink-2">
          I would first agree on corpus size, freshness, latency, and who may read each document. I would keep ingestion
          separate from query serving, version every source, and publish a version only after its chunks are indexed.
          At query time I would derive the access scope from the authenticated identity, retrieve semantic and lexical
          candidates within that scope, rerank a bounded set, and generate only from those passages with validated
          citations. If the evidence is weak or conflicting, the system abstains or says what conflicts. I would test
          retrieval recall, grounded claims, citation accuracy, permission isolation, update lag, latency, and cost as
          separate signals.
        </blockquote>
      </Section>

      <Section id="practice" title="RAG system design interview practice: four follow-up questions">
        <p className="max-w-[72ch] text-[0.9375rem] leading-relaxed text-ink-2">
          Set a ten-minute timer. Sketch the ingestion and query paths, then answer each follow-up before opening its
          comparison. Focus on the guarantee and the mechanism that enforces it; naming a vector database is not an
          answer to a failure question.
        </p>
        <ol className="mt-4 max-w-[72ch] divide-y divide-rule border-y border-rule">
          {[
            [
              "A new document version is only half indexed. What should a query see?",
              "Keep the new version pending. Continue serving the last complete version until the expected chunks and metadata are queryable, then switch the active-version pointer as one logical change. A retry must be idempotent for the source, document, and version; it must not expose a partial index.",
            ],
            [
              "A user's permission is revoked while an answer is being generated. Where must the check happen?",
              "Derive the retrieval scope from the trusted identity and enforce it before document text enters model context. Recheck authorization before returning the answer and citations. If access changed during generation, discard that response. A prompt instruction cannot retract private text already sent to the model, and a shared cache must account for permission changes or be bypassed.",
            ],
            [
              "A deleted document reappears after a delayed connector retry. How do you stop it?",
              "Record a tombstone keyed by the source and document version, and make connector checkpoints and retries respect it. Apply deletion to lexical and vector indexes and invalidate affected caches; do not let an older retry resurrect the document.",
            ],
            [
              "Answers sound fluent, but users say the right evidence is missing. Which metric do you inspect first?",
              "Inspect retrieval recall at k against expected source passages before changing the generation prompt. Then measure claim support, citation accuracy, and abstention separately. If the needed passage never reaches the model, a more fluent model cannot fix retrieval coverage.",
            ],
          ].map(([question, answer], index) => (
            <li key={question} className="py-4">
              <h3 className="text-[0.9375rem] font-medium">
                <span className="mr-2 font-mono text-[0.75rem] text-ink-3">{index + 1}.</span>
                {question}
              </h3>
              <details className="mt-2 text-[0.875rem] leading-relaxed text-ink-2">
                <summary className="cursor-pointer font-medium text-accent hover:underline">Compare your reasoning</summary>
                <p className="mt-2">{answer}</p>
              </details>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="sources" title="Primary sources and scope">
        <ul className="max-w-[72ch] list-disc space-y-2 pl-5 text-[0.9375rem] leading-relaxed text-ink-2">
          <li>
            <a className="link" href="https://docs.cohere.com/docs/retrieval-augmented-generation-rag">Cohere RAG documentation</a>{" "}
            describes retrieval, reranking, generation with citations, and caveats about source quality. This
            walkthrough uses general mechanisms, not a vendor-specific architecture.
          </li>
          <li>
            <a className="link" href="https://docs.cohere.com/page/rag-evaluation-deep-dive">Cohere RAG output evaluation</a>{" "}
            demonstrates retrieval precision, recall, and ranking metrics, then evaluates generated claims separately.
          </li>
          <li>
            <a className="link" href="https://developers.openai.com/api/reference/resources/vector_stores/subresources/file_batches">OpenAI vector-store file batches</a>{" "}
            documents batch indexing, per-file attributes, and configurable chunking in one hosted retrieval API.
          </li>
        </ul>
      </Section>

      <Section id="faq" title="RAG system design interview questions">
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
          Now explain how a permission revocation takes effect while an old answer is cached.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href="/system-design-mock-interview" className="btn btn-primary">
            Start a timed mock interview
          </Link>
          <Link href="/system-design-interview/design-llm-inference" className="btn btn-secondary">
            Continue with LLM inference design
          </Link>
        </div>
      </section>
      <ContentUsefulness />
    </article>
  );
}
