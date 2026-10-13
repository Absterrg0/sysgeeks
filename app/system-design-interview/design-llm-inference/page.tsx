import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Section } from "@/components/page-header";
import { breadcrumbs, faqPage, jsonLd, pageMetadata } from "@/lib/metadata";
import { SITE_NAME, SITE_URL } from "@/lib/site";

const PATH = "/system-design-interview/design-llm-inference";
const TITLE = "LLM Inference System Design: Interview Walkthrough";
const DESCRIPTION =
  "Practice LLM inference system design: estimate token throughput, schedule GPU batches, stream responses, balance tenant workloads, and handle failures.";

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

const FAQ = [
  {
    question: "How do you design an LLM inference service in a system design interview?",
    answer:
      "Separate the API and admission path from GPU execution. Authenticate each tenant, validate and bound token usage, route to a pinned model version, admit requests to a bounded scheduler, batch active sequences on GPU workers, and stream results while recording token usage. Protect latency with per-tenant limits, deadlines, and explicit overload behavior.",
  },
  {
    question: "Why is request QPS not enough to size an LLM service?",
    answer:
      "Requests have different prompt and output lengths. Estimate input tokens per second as request rate times average prompt tokens, and generated tokens per second as request rate times average output tokens. Then benchmark the chosen model, hardware, context lengths, and concurrency; those measurements determine replica capacity.",
  },
  {
    question: "What does continuous batching improve?",
    answer:
      "A continuous batch can admit new requests and remove completed ones as generation proceeds, keeping compatible work on the accelerator. Higher batch occupancy can improve throughput, while queueing and batch delay can worsen time to first token or gaps between streamed tokens. Tune both against the service's latency target.",
  },
  {
    question: "What happens if a GPU worker fails after streaming has started?",
    answer:
      "The service cannot safely pretend that a restarted generation is the same response: it may repeat or change tokens. End the stream with an error and request identifier, account for already generated usage according to the product contract, and let the client explicitly retry as a new attempt. A retry before generation begins is a different case.",
  },
  {
    question: `Can I practise this design on ${SITE_NAME}?`,
    answer:
      "Yes. Review the worked answer, then use the model inference API example to inspect a related architecture and the timed mock interview to practise explaining your decisions.",
  },
];

export default function DesignLlmInferencePage() {
  return (
    <article className="measure">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@graph": [
              breadcrumbs([
                { name: "System design interview guide", path: "/system-design-interview" },
                { name: "Design an LLM inference service", path: PATH },
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
                about: ["LLM inference", "Large language model serving", "System design interview"],
              },
              faqPage(FAQ),
            ],
          }),
        }}
      />

      <PageHeader title="Design an LLM inference service: a system design interview walkthrough" meta="By SysGeeks">
        Design an API that serves text from self-hosted language models to multiple customers. The key decisions are
        how to admit work before GPUs are saturated, how to trade batching against response latency, and what to do
        when a worker fails mid-stream. This is an interview design with explicit boundaries, not a claim about any
        provider&apos;s private architecture.
      </PageHeader>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/system-design-interview/llm-inference-capacity" className="btn btn-accent">
          Estimate LLM inference capacity
        </Link>
        <Link href="/projects/examples/ml-inference-api" className="btn btn-accent">
          Explore the model inference API example
        </Link>
        <Link href="/system-design-mock-interview" className="btn btn-secondary">
          Practise in a timed mock interview
        </Link>
      </div>

      <Section id="scope" title="Clarify the system before choosing GPUs">
        <div className="max-w-[72ch] space-y-4 text-[0.9375rem] leading-relaxed text-ink-2">
          <p>
            Start by asking whether the service runs its own model weights or routes to an external model provider.
            This walkthrough assumes self-hosted, open-weight models, a text completion API, multiple customer
            accounts, and streamed output. Model training, retrieval, tools, and multimodal inputs are separate
            extensions; add them only if the interviewer includes them.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Customers authenticate, choose an allowed model, set generation limits, and receive a token stream.</li>
            <li>Each request uses one model version for its full lifetime, including after a rollout begins.</li>
            <li>Usage is attributed to a customer so quotas and invoices can be reconciled.</li>
            <li>Overload, cancellation, timeouts, and worker failures have clear behavior for the caller.</li>
          </ul>
          <p>
            Ask for the target time to first token, acceptable delay between streamed chunks, request volume, prompt
            and output lengths, availability, and cost constraints. If those numbers are not given, state assumptions
            and label them before estimating.
          </p>
        </div>
      </Section>

      <Section id="capacity" title="Estimate token throughput alongside request rate">
        <div className="max-w-[72ch] space-y-4 text-[0.9375rem] leading-relaxed text-ink-2">
          <p>
            For a request rate <code>R</code>, average prompt length <code>P</code>, and average generated length{" "}
            <code>G</code>, estimate input work as <code>R × P prompt tokens per second</code> and output work as{" "}
            <code>R × G generated tokens per second</code>. Keep the two figures separate: prompt processing and
            autoregressive generation stress the serving path differently.
          </p>
          <p>
            Request QPS hides the difference between short and long prompts, answers, and concurrent generations. Ask
            for their distributions as well as averages; a small tail of very long contexts can occupy memory and
            delay other requests. The <Link href="/capacity-estimator" className="link">capacity estimator</Link> helps
            with rough request rate and network volume, but it does not predict GPU count. Benchmark the actual model,
            accelerator, context mix, and latency target before making a hardware estimate. The official{" "}
            <a className="link" href="https://docs.vllm.ai/en/latest/benchmarking/cli/">vLLM benchmark guide</a>{" "}
            describes serving measurements such as time to first token and inter-token latency.
          </p>
        </div>
      </Section>

      <Section id="architecture" title="A defensible high-level architecture">
        <ol className="max-w-[72ch] divide-y divide-rule border-y border-rule">
          {[
            ["API gateway", "Terminates TLS, authenticates the API key, applies request-size limits, and attaches the customer identity. It rejects malformed or unauthorized calls before they can consume accelerator time."],
            ["Admission controller", "Checks model access, context length, max output tokens, tenant quota, and current capacity. It reserves a bounded amount of work rather than treating every request as one equal-sized unit."],
            ["Model router and scheduler", "Routes each admitted request to a compatible model-version pool. A bounded queue applies deadlines and fair scheduling; when the queue is full, return an overload response instead of allowing wait time to grow without limit."],
            ["GPU inference workers", "Keep model weights loaded and schedule compatible sequences for prefill and token generation. Use the runtime's batching and KV-cache management, and expose queue, memory, and token-throughput signals for capacity control."],
            ["Streaming response", "Returns generated chunks as they are ready, with a request identifier and a clear terminal status. A disconnected client cancels queued work or asks the worker to stop generation when possible."],
            ["Usage ledger", "Emits an idempotent usage event keyed by request and attempt. A separate consumer aggregates token counts for quotas and billing so a billing-store slowdown does not block token delivery."],
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
        <p className="mt-4 max-w-[72ch] text-[0.9375rem] leading-relaxed text-ink-2">
          Store model manifests and immutable weight artifacts in a registry and object store. Workers load a pinned
          version before becoming healthy; the router sends new requests to a canary pool first, while in-flight
          streams stay on the version that accepted them.
        </p>
      </Section>

      <Section id="scheduling" title="Balance batching throughput against queue time">
        <div className="max-w-[72ch] space-y-4 text-[0.9375rem] leading-relaxed text-ink-2">
          <p>
            Continuous batching lets the scheduler admit new requests and remove completed ones as generation
            proceeds, so a batch does not have to wait for its slowest response to finish. A runtime may also group
            stateless inference calls dynamically. Both approaches can raise accelerator utilization, but a batching
            delay adds time before work starts. Tune batch size and delay against the latency budget, and measure the
            result on the chosen workload. See the official vLLM{" "}
            <a className="link" href="https://docs.vllm.ai/en/latest/">serving documentation</a> and NVIDIA Triton{" "}
            <a className="link" href="https://docs.nvidia.com/deeplearning/triton-inference-server/user-guide/docs/user_guide/batcher.html">batcher guide</a>.
          </p>
          <p>
            Bound active sequences and queued tokens per model pool. A request with a long prompt or a large maximum
            output budget can consume much more memory and time than a short request. Use per-customer concurrency
            limits and a fair scheduler so one tenant cannot monopolize the GPU queue. If the system cannot meet a
            deadline, reject early with a retryable overload response or route to a compatible fallback model when
            the product contract allows it.
          </p>
          <p>
            Keep prompt caching optional and scoped to data the customer is allowed to reuse. A cache hit can skip
            repeated prompt work, but it does not remove the need to check tenant boundaries, model version, and
            freshness. Avoid presenting a cache as a substitute for token and queue limits.
          </p>
        </div>
      </Section>

      <Section id="failures" title="Trace the failures that change the design">
        <dl className="max-w-[72ch] divide-y divide-rule border-y border-rule">
          {[
            ["The queue grows during a traffic spike", "Queue time becomes part of the first-token delay. Bound queued requests and prompt tokens, shed load before the latency target is impossible, and scale on queue time and token throughput rather than request count alone."],
            ["A long context fills the KV cache", "Reject requests over the model's context limit, bound active token budgets, and watch cache usage and preemptions. A larger queue does not create more GPU memory."],
            ["A worker dies before the first token", "If the request is known not to have started, another healthy replica can accept the same request id under an explicit retry policy. Record the attempt so usage is not counted twice."],
            ["A worker dies after some tokens were sent", "The client has already observed a partial answer. End the stream clearly; do not silently restart and concatenate a second generation. Preserve the request and attempt ids so support and billing can explain the outcome."],
            ["A new model version behaves badly", "Stop routing new requests to the canary and shift traffic back. Do not move an active stream between versions; keep weights immutable and track which version handled each request."],
            ["The client disconnects", "Cancel work waiting in the queue immediately. Propagate cancellation to generation where supported, then record whether any tokens were produced so usage follows the stated billing rule."],
          ].map(([failure, response]) => (
            <div key={failure} className="py-4">
              <dt className="font-medium">{failure}</dt>
              <dd className="mt-1 text-[0.9375rem] leading-relaxed text-ink-2">{response}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section id="observability" title="Measure the user-visible bottleneck">
        <div className="max-w-[72ch] space-y-4 text-[0.9375rem] leading-relaxed text-ink-2">
          <p>
            Track request queue time, time to first token, inter-token latency, end-to-end latency, prompt and
            generated tokens, active and waiting requests, KV-cache usage, preemptions, cancellations, and errors.
            Break the measurements down by model version and workload class; sample customer identifiers carefully so
            metrics do not expose prompt content.
          </p>
          <p>
            vLLM documents metrics for queue time, time to first token, inter-token latency, token counts, and KV-cache
            use in its{" "}
            <a className="link" href="https://docs.vllm.ai/en/latest/usage/metrics/">production metrics guide</a>.
            Those separate signals help tell whether a slowdown comes from admission, prompt processing, generation,
            or memory pressure. Watch p95 and p99 alongside the average, since a good average can hide a poor tail.
          </p>
        </div>
      </Section>

      <Section id="answer" title="A concise interview answer">
        <blockquote className="max-w-[72ch] border-l-2 border-accent pl-5 text-[0.9375rem] leading-relaxed text-ink-2">
          I would first pin down the model, prompt and output length distributions, latency targets, and whether we
          host the weights. I would estimate prompt and generated tokens per second separately, then admit requests
          through bounded per-model queues with tenant limits. GPU workers keep a pinned model version loaded and
          batch compatible sequences; the API streams tokens and propagates cancellation. If the queue or token budget
          is full, I reject early rather than promise a latency the system cannot meet. I would monitor queue time,
          first-token time, inter-token latency, token throughput, and KV-cache pressure, then use benchmark results to
          decide when to add replicas or change the model.
        </blockquote>
        <p className="mt-4 max-w-[72ch] text-[0.9375rem] leading-relaxed text-ink-2">
          A strong answer connects the request budget, scheduling policy, latency promise, and retry semantics.
        </p>
      </Section>

      <Section id="sources" title="Sources and scope">
        <ul className="max-w-[72ch] list-disc space-y-2 pl-5 text-[0.9375rem] leading-relaxed text-ink-2">
          <li>
            <a className="link" href="https://docs.vllm.ai/en/latest/usage/metrics/">vLLM production metrics</a>{" "}
            documents serving metrics, including waiting requests, queue time, token latency, and KV-cache usage.
          </li>
          <li>
            <a className="link" href="https://docs.vllm.ai/en/latest/benchmarking/cli/">vLLM benchmark CLI</a>{" "}
            describes serving benchmarks for request latency and token throughput.
          </li>
          <li>
            <a className="link" href="https://docs.nvidia.com/deeplearning/triton-inference-server/user-guide/docs/user_guide/batcher.html">NVIDIA Triton batchers</a>{" "}
            describes dynamic batching, queue limits, timeouts, and the latency-throughput tradeoff.
          </li>
          <li>
            <a className="link" href="https://www.anthropic.com/engineering/managed-agents">Anthropic Engineering: Managed Agents</a>{" "}
            explains time to first token as a user-visible delay in one production system. That account supports the
            metric definition; this page&apos;s design remains an independent interview exercise.
          </li>
        </ul>
      </Section>

      <Section id="faq" title="LLM inference system design questions">
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
          Now defend the queue limit when the interviewer doubles prompt length and keeps request QPS unchanged.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href="/projects/examples/ml-inference-api" className="btn btn-primary">
            Study the model inference API example
          </Link>
          <Link href="/capacity-estimator" className="btn btn-secondary">
            Estimate request volume
          </Link>
        </div>
      </section>
    </article>
  );
}
