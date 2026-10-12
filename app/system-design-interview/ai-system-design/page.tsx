import type { Metadata } from "next";
import Link from "next/link";
import { TrackedWalkthroughLink } from "@/components/tracked-walkthrough-link";
import { PageHeader, Section } from "@/components/page-header";
import { breadcrumbs, faqPage, itemList, jsonLd, pageMetadata } from "@/lib/metadata";
import { SITE_NAME, SITE_URL } from "@/lib/site";

const PATH = "/system-design-interview/ai-system-design";
const TITLE = "AI System Design Interview Questions & Practice";
const DESCRIPTION =
  "Practice AI system design interview questions with free walkthroughs for LLM inference, private-document RAG, and AI agents. No signup.";

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

const CASES = [
  {
    title: "Design an LLM inference service",
    href: "/system-design-interview/design-llm-inference",
    prompt:
      "Design a model-serving API for a chat product. Prompt and response lengths vary, users expect streaming, and GPU capacity is limited.",
    focus: "Estimate prompt and generated-token throughput, schedule GPU work, stream within a latency target, and handle overload or worker failure.",
    hardPart: "Throughput and latency",
    followUp: "A traffic burst triples average prompt length while a GPU worker fails. What do you queue, reject, or retry, and what does the caller see?",
  },
  {
    title: "Design a RAG system for private documents",
    href: "/system-design-interview/design-rag-system",
    prompt:
      "Design an assistant that answers employee questions from company documents. Access depends on each employee's permissions, and the source documents keep changing.",
    focus: "Separate ingestion from query serving, keep retrieval inside the caller's permissions, publish fresh versions safely, and return evidence-backed answers.",
    hardPart: "Retrieval, permissions, and freshness",
    followUp: "A document changes while an answer is being generated, or a user's access is revoked. How do you prevent stale or unauthorized content from reaching the model?",
  },
  {
    title: "Design a customer-support AI agent",
    href: "/system-design-interview/design-ai-agent",
    prompt:
      "Design a support agent that can update subscriptions and issue refunds. It must keep users in control and recover safely when a tool call times out.",
    focus: "Bound tool access, persist runs and actions, make external effects safe to retry, and decide what to do when the model or a tool fails.",
    hardPart: "Authority and side effects",
    followUp: "A refund succeeds at the payment provider, but the response times out. How does a retry avoid a second refund, and how can support staff audit the outcome?",
  },
] as const;

const FAQ = [
  {
    question: "What AI system design interview questions should I practise?",
    answer:
      "Practise designing an LLM inference service, a retrieval-augmented assistant over private documents, and an AI agent that can take customer-support actions. For each, clarify the quality and latency targets, estimate the workload, enforce permissions, and reason through a failure. These are original practice prompts, not claims about any employer's interview loop.",
  },
  {
    question: "What is different about an AI system design interview?",
    answer:
      "The core interview skills stay the same: clarify requirements, estimate capacity, compare designs, and trace failures. AI systems add constraints such as token-length distributions, model quality, retrieval freshness, evaluation, and the boundary between model suggestions and authorized actions.",
  },
  {
    question: "Should I memorize an AI system design architecture?",
    answer:
      "No. Start from the task, quality target, data permissions, latency, and cost. Then choose the simplest architecture that meets them and explain how it behaves when the model, index, GPU worker, or tool is unavailable.",
  },
  {
    question: "Are these questions asked by specific companies?",
    answer:
      "No. These are original practice exercises based on public engineering material and documented mechanisms. They do not claim to reproduce any employer's interview questions or private architecture.",
  },
];

export default function AiSystemDesignPage() {
  return (
    <article className="measure">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@graph": [
              breadcrumbs([
                { name: "System design interview guide", path: "/system-design-interview" },
                { name: "AI system design interview practice", path: PATH },
              ]),
              {
                "@type": "CollectionPage",
                name: TITLE,
                description: DESCRIPTION,
                url: `${SITE_URL}${PATH}`,
                isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
                mainEntity: itemList(
                  "AI system design interview walkthroughs",
                  CASES.map(({ title, href }) => ({ name: title, path: href })),
                ),
              },
              faqPage(FAQ),
            ],
          }),
        }}
      />

      <PageHeader title="AI system design interview practice">
        Practise three AI system design problems: serving language models, answering from private documents, and
        letting an agent take actions. The same interview framework applies, but token workloads, retrieval quality,
        permissions, and model-driven side effects change what a strong design must guarantee.
      </PageHeader>

      <Section id="choose" title="AI system design interview questions to practise">
        <ol className="max-w-[72ch] divide-y divide-rule border-y border-rule">
          {CASES.map((item, index) => (
            <li key={item.href} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 py-5">
              <span className="pt-0.5 font-heading text-[1.125rem] text-ink-3 tabular-nums">{index + 1}</span>
              <div>
                <h2 className="text-[1rem] font-medium">
                  <TrackedWalkthroughLink
                    href={item.href}
                    slug={item.href.split("/").at(-1) ?? "unknown"}
                    placement="title"
                    className="hover:text-accent hover:underline"
                  >
                    {item.title}
                  </TrackedWalkthroughLink>
                </h2>
                <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-2">
                  <strong className="font-medium text-ink">Prompt:</strong> {item.prompt}
                </p>
                <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-2">
                  <strong className="font-medium text-ink">Work through:</strong> {item.focus} The central design
                  pressure is {item.hardPart.toLowerCase()}.
                </p>
                <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-3">
                  <strong className="font-medium text-ink-2">Follow-up:</strong> {item.followUp}
                </p>
                <TrackedWalkthroughLink
                  href={item.href}
                  slug={item.href.split("/").at(-1) ?? "unknown"}
                  placement="exercise_link"
                  className="mt-3 inline-flex text-[0.875rem] font-medium text-accent hover:underline"
                >
                  Try the full design exercise →
                </TrackedWalkthroughLink>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="differences" title="What changes when a system uses AI?">
        <dl className="max-w-[72ch] divide-y divide-rule border-y border-rule">
          <div className="py-4">
            <dt className="text-[0.9375rem] font-medium">Capacity is more than requests per second</dt>
            <dd className="mt-1 text-[0.9375rem] leading-relaxed text-ink-2">
              Prompt length, generated tokens, context size, and concurrent generations shape inference cost and
              latency. Estimate them separately, then benchmark the model and hardware instead of guessing a GPU count.
            </dd>
          </div>
          <div className="py-4">
            <dt className="text-[0.9375rem] font-medium">Quality needs its own measurement</dt>
            <dd className="mt-1 text-[0.9375rem] leading-relaxed text-ink-2">
              Retrieval can be stale or irrelevant, and a model can make unsupported claims. Measure retrieval quality
              separately from answer quality; use citations or abstention when the available evidence is weak.
            </dd>
          </div>
          <div className="py-4">
            <dt className="text-[0.9375rem] font-medium">Permissions must hold before data reaches the model</dt>
            <dd className="mt-1 text-[0.9375rem] leading-relaxed text-ink-2">
              Derive access scope from trusted identity and enforce it in application code before building model
              context. A prompt instruction is not an authorization boundary.
            </dd>
          </div>
          <div className="py-4">
            <dt className="text-[0.9375rem] font-medium">Model decisions and real-world actions need different controls</dt>
            <dd className="mt-1 text-[0.9375rem] leading-relaxed text-ink-2">
              Keep policy checks, durable action state, and idempotency in deterministic services. Give the model only
              the tools and arguments the application has authorized.
            </dd>
          </div>
        </dl>
      </Section>

      <Section id="framework" title="A repeatable way to answer">
        <ol className="max-w-[72ch] space-y-4 text-[0.9375rem] leading-relaxed text-ink-2">
          <li>
            <strong className="font-medium text-ink">1. Define the contract.</strong> Identify who uses the system,
            what the model may do, what quality means, and which actions must never happen without authorization.
          </li>
          <li>
            <strong className="font-medium text-ink">2. Put numbers on the workload.</strong> Estimate request rate,
            token and context distributions, corpus size or update rate, latency targets, and cost limits.
          </li>
          <li>
            <strong className="font-medium text-ink">3. Separate the paths.</strong> Draw latency-sensitive serving
            separately from ingestion and evaluation, and keep orchestration separate from permission checks and
            external writes.
          </li>
          <li>
            <strong className="font-medium text-ink">4. Trace a failure.</strong> Work through overload, stale data,
            model or worker failure, and uncertain tool outcomes. Explain what the caller sees and how the system
            recovers safely.
          </li>
          <li>
            <strong className="font-medium text-ink">5. Explain how you will know it works.</strong> Pick measures
            for latency and cost alongside task success, retrieval quality, or action correctness.
          </li>
        </ol>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/system-design-interview/llm-inference-capacity" className="btn btn-secondary">
            Estimate LLM inference memory and token load
          </Link>
          <Link href="/system-design-mock-interview" className="btn btn-accent">
            Practise a timed system design mock
          </Link>
          <Link href="/system-design-interview" className="btn btn-secondary">
            Read the general interview framework
          </Link>
        </div>
      </Section>

      <Section id="faq" title="AI system design interview questions">
        <dl className="max-w-[72ch] divide-y divide-rule border-y border-rule">
          {FAQ.map((item) => (
            <div key={item.question} className="py-4">
              <dt className="text-[0.9375rem] font-medium">{item.question}</dt>
              <dd className="mt-1 text-[0.9375rem] leading-relaxed text-ink-2">{item.answer}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <section aria-label="Start practising" className="section border-t border-rule">
        <p className="max-w-[66ch] text-[0.9375rem] leading-relaxed text-ink-2">
          These are practice designs, not a list of employer interview questions. The walkthroughs explain their
          assumptions and link to the public engineering sources behind the design choices.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/investigations" className="btn btn-primary">
            Browse all design exercises
          </Link>
          <Link href="/capacity-estimator" className="btn btn-secondary">
            Estimate system capacity
          </Link>
        </div>
      </section>
    </article>
  );
}
