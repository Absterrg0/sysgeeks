import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Section } from "@/components/page-header";
import { breadcrumbs, faqPage, jsonLd, pageMetadata } from "@/lib/metadata";
import { SITE_URL } from "@/lib/site";

const PATH = "/system-design-interview/design-ai-agent";
const TITLE = "AI Agent System Design Interview: Worked Example";
const DESCRIPTION =
  "Practise designing a customer-support AI agent: scoped tools, safe refunds, durable runs, idempotency, prompt injection, evaluation, and failure recovery.";

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

const FAQ = [
  {
    question: "How do you design an AI agent in a system design interview?",
    answer:
      "Start with the task, the actions the agent may take, and the cost of a wrong action. Keep an orchestrator in control of a bounded run, expose narrow tools through a permission-checking gateway, store durable task and action state, make external writes idempotent, and record enough trace data to evaluate failures. Begin with one agent; add autonomy or multiple agents only when the task needs it.",
  },
  {
    question: "How do you stop an AI agent from issuing a refund twice?",
    answer:
      "Create a durable action record with a stable idempotency key before calling the payment provider. Reuse that key for retries, store the provider result, and reconcile an unknown timeout before attempting another action. Tell the user the refund is pending until the provider confirms it.",
  },
  {
    question: "How should an AI agent handle prompt injection?",
    answer:
      "Treat messages, retrieved documents, and tool results as untrusted data. Keep authorization and action policy in deterministic application code, derive tenant and user scope from verified identity, validate every tool call, and require approval for actions whose risk exceeds the product's policy.",
  },
  {
    question: "Should an AI system design interview use multiple agents?",
    answer:
      "Not by default. Use a fixed workflow when the task has a predictable sequence. Start with one bounded agent when it must choose among tools or adapt its steps, then introduce multiple agents only when independent work or specialization produces a measurable benefit that justifies coordination and failure costs.",
  },
  {
    question: "Is this an actual company or employer interview question?",
    answer:
      "No. It is an original practice scenario for learning system design. It does not claim to describe a specific company's interview loop or private architecture.",
  },
];

const COMPONENTS = [
  ["Conversation API", "Authenticates the caller, applies request limits, and creates a task. It returns a task ID so the client can resume after a disconnect."],
  ["Run orchestrator", "Owns the run state machine, step limit, deadline, cancellation, and model calls. It decides whether the next result is a user-facing answer, a validated tool call, or a handoff for approval."],
  ["Policy and tool gateway", "Derives tenant and user scope from trusted identity, checks the action against policy, validates typed arguments, and gives each tool only the authority it needs."],
  ["Support tools", "Read order and policy data through scoped APIs. A refund tool accepts a stable action ID and asks the payment service to perform one idempotent operation."],
  ["Task and action store", "Persists the conversation reference, run state, step count, pending actions, idempotency keys, and confirmed outcomes. A queue resumes work without making the browser responsible for execution."],
  ["Trace and evaluation store", "Records model and prompt versions, tool names, timings, outcomes, policy decisions, and redacted error classes. It supports debugging and offline evaluation without treating the model's own confidence as proof of success."],
] as const;

const FAILURES = [
  ["The model repeats a refund tool call", "The gateway resolves the same action ID to the existing result; the provider sees the same idempotency key."],
  ["The provider times out after accepting a refund", "Persist the action as pending, query by idempotency key or provider reference, and reconcile before retrying. Do not tell the customer it succeeded yet."],
  ["A worker dies during a run", "The lease expires and a worker resumes from durable run state. Completed actions remain completed; uncommitted work is retried within the run deadline."],
  ["A retrieved message says to ignore policy", "Treat it as content, not authority. The policy gateway still enforces identity, tenant scope, refund limits, and approval rules."],
  ["The model or payment provider is unavailable", "Use bounded retries with backoff for safe operations, then return a clear pending or unavailable state. Do not retry a non-idempotent write blindly."],
  ["The customer asks about another account", "The read tool filters by the authenticated caller's scope. The model never chooses or supplies an authoritative tenant ID."],
] as const;

export default function DesignAiAgentPage() {
  return (
    <article className="measure">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@graph": [
              breadcrumbs([
                { name: "System design interview guide", path: "/system-design-interview" },
                { name: "Design an AI agent", path: PATH },
              ]),
              {
                "@type": "LearningResource",
                name: TITLE,
                description: DESCRIPTION,
                url: SITE_URL + PATH,
                learningResourceType: "System design interview walkthrough",
                educationalLevel: "Intermediate to advanced",
                isAccessibleForFree: true,
                inLanguage: "en",
                author: { "@id": SITE_URL + "/#organization" },
                provider: { "@id": SITE_URL + "/#organization" },
              },
              faqPage(FAQ),
            ],
          }),
        }}
      />

      <PageHeader title="Design an AI agent: a system design interview walkthrough" eyebrow="AI systems · practice prompt" meta="By SysGeeks">
        Design a customer-support agent that can answer questions, look up orders, and issue refunds. The hard parts
        are giving the model useful choices without giving it authority, surviving uncertain tool outcomes, and
        proving that the system works. This is an original practice design, not a claim about an employer&apos;s loop or
        private architecture.
      </PageHeader>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/review#session" className="btn btn-accent">Practise in a timed mock interview</Link>
        <Link href="/system-design-interview/design-rag-system" className="btn btn-secondary">Study the RAG design</Link>
        <Link href="/system-design-interview/design-llm-inference" className="btn btn-secondary">Study LLM serving</Link>
      </div>

      <Section id="prompt" title="The interview prompt">
        <div className="max-w-[72ch] space-y-4 text-[0.9375rem] leading-relaxed text-ink-2">
          <p>
            Build an assistant for a commerce support team. It can explain order status, answer questions from the
            current return policy, and issue a refund when the request is eligible. A refund must not happen twice. A
            customer must never see another customer&apos;s data. If the payment system&apos;s response is uncertain, the
            assistant must not claim the refund completed.
          </p>
          <p>
            Before drawing boxes, ask about volume, supported languages, response-time targets, refund limits, policy
            freshness, and which cases need a human. Those answers determine whether a read can be eventually
            consistent, how long a run may wait, and which actions need approval. Do not invent a scale and then
            optimize for it.
          </p>
        </div>
      </Section>

      <Section id="short-answer" title="A defensible starting design">
        <p className="max-w-[72ch] text-[0.9375rem] leading-relaxed text-ink-2">
          Keep the control loop in an orchestrator. Give one model a small set of typed tools, but make a separate
          application gateway enforce identity, scope, policy, and idempotency on every call. Persist each run and
          action before doing external work. The model proposes what to do; deterministic services decide whether it
          is allowed and whether it actually succeeded.
        </p>
        <ol className="mt-5 max-w-[72ch] divide-y divide-rule border-y border-rule">
          {COMPONENTS.map(([name, role]) => (
            <li key={name} className="grid gap-1 py-3 sm:grid-cols-[13rem_minmax(0,1fr)] sm:gap-5">
              <h3 className="text-[0.9375rem] font-medium">{name}</h3>
              <p className="text-[0.875rem] leading-relaxed text-ink-2">{role}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="refund-flow" title="Trace one refund from request to confirmation">
        <ol className="max-w-[72ch] space-y-4 text-[0.9375rem] leading-relaxed text-ink-2">
          <li><strong className="font-medium text-ink">1. Create a run.</strong> Verify the customer, create a durable task ID, and set a deadline and maximum number of model/tool steps.</li>
          <li><strong className="font-medium text-ink">2. Gather only needed context.</strong> Fetch the caller&apos;s eligible orders through a scoped read tool. Retrieve the current return policy with its version and effective date.</li>
          <li><strong className="font-medium text-ink">3. Let the model propose.</strong> The model may explain the policy or request a refund tool call. It cannot choose the account scope, bypass an eligibility rule, or call the payment provider directly.</li>
          <li><strong className="font-medium text-ink">4. Validate in application code.</strong> Check ownership, amount, order state, policy version, refund limit, and whether a human approval is required.</li>
          <li><strong className="font-medium text-ink">5. Record before executing.</strong> Insert a pending action with a stable idempotency key. Then call the payment service using that key.</li>
          <li><strong className="font-medium text-ink">6. Reconcile the outcome.</strong> Store the provider&apos;s confirmed result. On timeout, keep the action pending and look it up by key before retrying.</li>
          <li><strong className="font-medium text-ink">7. Answer from the result.</strong> The orchestrator gives the model the confirmed outcome to explain. If the action is unresolved, tell the customer it is still being checked.</li>
        </ol>
      </Section>

      <Section id="failures" title="Failure cases worth discussing">
        <div className="overflow-x-auto">
          <table className="data-table min-w-[42rem]">
            <caption className="sr-only">AI agent failures and the system mechanism that contains them</caption>
            <thead><tr><th scope="col">Failure</th><th scope="col">System response</th></tr></thead>
            <tbody>
              {FAILURES.map(([failure, response]) => <tr key={failure}><th scope="row">{failure}</th><td>{response}</td></tr>)}
            </tbody>
          </table>
        </div>
        <p className="mt-4 max-w-[72ch] text-[0.875rem] leading-relaxed text-ink-2">
          Retries alone do not create exactly-once effects across a network. A request can succeed remotely while its
          response is lost. Use idempotency and reconciliation to make retries safe, and represent uncertainty as a
          real state the product can explain.
        </p>
      </Section>

      <Section id="authority" title="Keep authority outside the model">
        <div className="max-w-[72ch] space-y-4 text-[0.9375rem] leading-relaxed text-ink-2">
          <p>
            The model may interpret a request and select among tools. It should not be the source of truth for who the
            customer is, what they own, whether a refund is allowed, or whether an action succeeded. Derive identity
            from authentication, scope every read and write on the server, and validate tool arguments against a
            schema before execution.
          </p>
          <p>
            Treat user text, retrieved documents, and tool output as untrusted input. A retrieved page can inform the
            answer, but it cannot grant new permissions or override the action policy. Use narrow tools with explicit
            capabilities; require approval where the business risk calls for it; and keep a durable audit trail of
            policy decisions and external effects.
          </p>
          <p>
            This follows the principle of reducing excessive agency: grant only the tools and authority the task needs.
            See the primary-source guidance from{" "}
            <a className="link" href="https://genai.owasp.org/llmrisk/llm062025-excessive-agency/" target="_blank" rel="noreferrer">OWASP on excessive agency</a>{" "}
            and OpenAI&apos;s{" "}
            <a className="link" href="https://openai.com/business/guides-and-resources/a-practical-guide-to-building-agents/" target="_blank" rel="noreferrer">practical guide to building agents</a>.
          </p>
        </div>
      </Section>

      <Section id="workflow-or-agent" title="When is an agent actually needed?">
        <div className="max-w-[72ch] space-y-4 text-[0.9375rem] leading-relaxed text-ink-2">
          <p>
            If every request follows the same sequence—classify, fetch an order, check a rule, then reply—a fixed
            workflow is easier to test and operate. Use an agent when the task genuinely needs flexible tool selection
            or a plan that changes with the evidence. Start with one bounded agent; add multiple agents only when
            separate responsibilities or parallel work measurably improve the task enough to pay for coordination.
          </p>
          <p>
            This distinction between fixed workflows and model-directed agents is explained in Anthropic&apos;s primary
            source,{" "}
            <a className="link" href="https://www.anthropic.com/engineering/building-effective-agents" target="_blank" rel="noreferrer">Building Effective Agents</a>.
            The choice is a tradeoff in control, latency, cost, and task quality—not a maturity ladder.
          </p>
        </div>
      </Section>

      <Section id="evaluation" title="How to evaluate the design">
        <ul className="max-w-[72ch] list-disc space-y-2 pl-5 text-[0.9375rem] leading-relaxed text-ink-2">
          <li><strong className="font-medium text-ink">Task outcome:</strong> Was the issue resolved correctly, or did the assistant clearly hand it off?</li>
          <li><strong className="font-medium text-ink">Action safety:</strong> Were refunds eligible, scoped to the right customer, and applied at most once?</li>
          <li><strong className="font-medium text-ink">Grounding:</strong> Did policy answers use the current version and distinguish evidence from uncertainty?</li>
          <li><strong className="font-medium text-ink">Adversarial behavior:</strong> Did injected instructions in a message, document, or tool result fail to change permissions?</li>
          <li><strong className="font-medium text-ink">Reliability:</strong> What happened when a worker, model call, or payment response timed out or failed?</li>
          <li><strong className="font-medium text-ink">Operations:</strong> Track completion, escalation, duplicate-action prevention, tool errors, latency, tokens, and cost per resolved task.</li>
        </ul>
        <p className="mt-4 max-w-[72ch] text-[0.875rem] leading-relaxed text-ink-2">
          Build a regression set from normal requests and explicit edge cases: duplicate calls, timeouts after success,
          stale policy, cross-account attempts, prompt injection, and requests that should be refused or handed off.
          Measure the tool and business outcome, not just whether the model produced fluent text.
        </p>
      </Section>

      <Section id="follow-ups" title="Interview follow-ups">
        <dl className="max-w-[72ch] divide-y divide-rule border-y border-rule">
          {FAQ.map(({ question, answer }) => (
            <div key={question} className="py-4">
              <dt className="font-medium">{question}</dt>
              <dd className="mt-1 text-[0.9375rem] leading-relaxed text-ink-2">{answer}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[0.875rem]">
          <Link href="/system-design-interview/design-rag-system" className="link">Design a RAG system</Link>
          <Link href="/system-design-interview/design-llm-inference" className="link">Design LLM inference</Link>
          <Link href="/system-design-interview" className="link">System design interview preparation guide</Link>
          <Link href="/system-design-mock-interview" className="link">Free solo mock interview practice</Link>
        </div>
      </Section>
    </article>
  );
}
