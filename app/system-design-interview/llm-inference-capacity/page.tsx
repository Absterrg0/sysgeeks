import type { Metadata } from "next";
import Link from "next/link";
import { LlmInferenceCapacityEstimator } from "@/components/llm-inference-capacity-estimator";
import { PageHeader, Section } from "@/components/page-header";
import { breadcrumbs, faqPage, jsonLd, pageMetadata } from "@/lib/metadata";
import { SITE_NAME, SITE_URL } from "@/lib/site";

const PATH = "/system-design-interview/llm-inference-capacity";
const TITLE = "LLM Inference Capacity Calculator: Tokens, KV Cache, GPU Memory";
const DESCRIPTION =
  "Estimate LLM model weights, KV-cache memory, active sequences, and prompt/output token throughput for a system design interview. Free, in-browser, no signup.";

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

const FAQ = [
  {
    question: "How do you estimate KV-cache memory for an LLM?",
    answer:
      "For a full-attention decoder with uniform layers, estimate bytes per token as 2 × layers × key/value heads × head dimension × bytes per cache value. Multiply by the prompt plus reserved output tokens per active sequence, then by active sequences. Grouped-query attention uses the number of key/value heads, not the query-head count.",
  },
  {
    question: "Can this calculator tell me how many GPUs an LLM needs?",
    answer:
      "No. It compares a rough model-weight and KV-cache estimate with the aggregate memory in one model replica. It does not predict accelerator throughput, tensor-parallel efficiency, runtime workspaces, or whether the model is evenly shardable. Benchmark the chosen model and serving stack on the target GPUs before planning production capacity.",
  },
  {
    question: "Why estimate input and output tokens per second separately?",
    answer:
      "Prompt processing and autoregressive generation have different execution behavior and bottlenecks. Multiply requests per second by average prompt and output lengths for token-demand estimates. For KV-cache capacity, use the prompt and output budgets you intend each active sequence to hold.",
  },
  {
    question: "Is this " + SITE_NAME + " LLM inference calculator free?",
    answer: "Yes. It runs in your browser, requires no account, and does not send the values you enter to the site.",
  },
];

export default function LlmInferenceCapacityPage() {
  return (
    <article className="measure">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@graph": [
              breadcrumbs([
                { name: "AI system design interview practice", path: "/system-design-interview/ai-system-design" },
                { name: "LLM inference capacity calculator", path: PATH },
              ]),
              {
                "@type": "SoftwareApplication",
                name: TITLE,
                applicationCategory: "DeveloperApplication",
                operatingSystem: "Any",
                isAccessibleForFree: true,
                description: DESCRIPTION,
                url: SITE_URL + PATH,
                offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
                publisher: { "@id": SITE_URL + "/#organization" },
              },
              faqPage(FAQ),
            ],
          }),
        }}
      />

      <PageHeader title="LLM inference capacity calculator" meta="Free · In-browser · No account">
        Estimate model-weight memory, KV-cache memory for active sequences, and the input and output token rates your
        serving design must handle. Use it to make a system design interview estimate, then benchmark the model and
        serving runtime on the target hardware before making a production capacity plan.
      </PageHeader>

      <Section id="calculator" title="Estimate LLM GPU memory and token workload">
        <LlmInferenceCapacityEstimator />
      </Section>

      <Section id="method" title="How the LLM inference estimate works">
        <div className="prose max-w-[72ch]">
          <p>
            Weight memory starts with parameter count multiplied by bytes per parameter. The KV cache stores keys and values
            for each active sequence. For a uniform full-attention model, the estimate per token is{" "}
            <code>2 × layers × KV heads × head dimension × bytes per cache value</code>. The factor of two accounts for keys
            and values. Multiply that by the prompt plus reserved output length and then by active sequences. The calculator
            uses the model&apos;s key/value-head count, which is important for grouped-query attention.
          </p>
          <p>
            The estimate adds model weights, a runtime/workspace reserve you choose, and KV cache for your target concurrency.
            It compares that sum with the selected fraction of aggregate GPU memory. Weight and KV memory can be partitioned
            differently by a serving runtime, so an aggregate fit is only a first check. NVIDIA&apos;s{" "}
            <a className="link" href="https://nvidia.github.io/TensorRT-LLM/reference/memory.html">TensorRT-LLM memory guide</a>{" "}
            describes weights, activation tensors, and KV cache as distinct inference memory contributors.
          </p>
          <p>
            Prompt tokens per second and generated tokens per second are separate workload estimates: request rate multiplied
            by average prompt length and output length, respectively. They are inputs for a benchmark plan, not a predicted
            GPU throughput. The token-rate estimates use averages; the KV-cache estimate uses the prompt and output
            budgets for active sequences. Measure time to first token, inter-token latency, throughput, and memory use
            with the target model, runtime, and length distribution. The{" "}
            <a className="link" href="https://huggingface.co/docs/transformers/main/kv_cache">Hugging Face KV-cache guide</a>{" "}
            explains how cache size grows with sequence length and model architecture.
          </p>
        </div>
      </Section>

      <Section id="practice" title="Use the estimate in an interview answer">
        <ol className="max-w-[72ch] list-decimal space-y-3 pl-5 text-[0.9375rem] leading-relaxed text-ink-2">
          <li>State the model, precision, prompt/output length distribution, concurrency, and latency target.</li>
          <li>Estimate input tokens per second, output tokens per second, and KV cache for the active sequences.</li>
          <li>Compare the memory estimate with one replica&apos;s GPU pool; include a reserve for runtime memory and fragmentation.</li>
          <li>Explain what you would benchmark and what your scheduler does when the queue or KV cache is full.</li>
        </ol>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/system-design-interview/design-llm-inference" className="btn btn-accent">
            Read the LLM inference design walkthrough
          </Link>
          <Link href="/system-design-mock-interview" className="btn btn-secondary">
            Practise a timed system design mock
          </Link>
        </div>
      </Section>

      <Section id="faq" title="LLM inference memory and capacity questions">
        <dl className="max-w-[72ch] divide-y divide-rule border-y border-rule">
          {FAQ.map(({ question, answer }) => (
            <div key={question} className="py-4">
              <dt className="font-medium">{question}</dt>
              <dd className="mt-1 text-[0.9375rem] leading-relaxed text-ink-2">{answer}</dd>
            </div>
          ))}
        </dl>
      </Section>
    </article>
  );
}
