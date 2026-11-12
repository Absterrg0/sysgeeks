import type { Metadata } from "next";
import Link from "next/link";
import { AiLabel } from "@/components/ai";
import { PageHeader, Section } from "@/components/page-header";
import { AI_PROVIDERS, PROVIDERS } from "@/lib/ai/providers";
import { MAX_AI_RUNS } from "@/lib/domain/learner";
import { breadcrumbs, jsonLd, pageMetadata } from "@/lib/metadata";
import { SITE_NAME, SITE_REPO_URL, SITE_URL } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: `How ${SITE_NAME} uses AI`,
  description: `${SITE_NAME} is free. Its optional AI features run in your browser on your own Anthropic, OpenAI, Gemini or OpenRouter API key. See what is sent, where, which models you can use, and what it costs.`,
  path: "/ai",
});

const FEATURES = [
  {
    name: "Assessment of a written answer",
    what: "Marks your answer against the rubric points of its question. Each mark quotes the sentence it relied on, and a quote that isn't in your answer is thrown away.",
    sent: "The question, its rubric and reference answer, and your answer.",
  },
  {
    name: "Draft from a description or README",
    what: "Drafts a project's architecture from text you give it, for you to check item by item.",
    sent: "Your text, and the name and constraints if you add them.",
  },
  {
    name: "Draft from a public GitHub repository",
    what: "Drafts a project's architecture from a public repository.",
    sent: "Up to 60 files your browser reads from GitHub: the README, dependency manifests, entry points and configuration, plus the list of file paths.",
  },
  {
    name: "Architecture review",
    what: "Reviews a project's architecture, or a design you changed in a playground, and reports where it fails and what each fix costs.",
    sent: "The project's components, flows, invariants, summary and constraints.",
  },
  {
    name: "Tailored question set",
    what: "Writes 8 to 12 interview questions about your own design.",
    sent: "The same as a review, plus the titles of your latest review's findings.",
  },
];

/** Upper bounds per run, from each feature's input limits and output budget (about four characters a token). */
const COSTS = [
  { name: "Assessment of a written answer", inTokens: 4_000, outTokens: 2_000 },
  { name: "Draft from a description or README", inTokens: 20_000, outTokens: 12_000 },
  { name: "Draft from a public repository", inTokens: 80_000, outTokens: 12_000 },
  { name: "Architecture review", inTokens: 15_000, outTokens: 10_000 },
  { name: "Tailored question set", inTokens: 15_000, outTokens: 8_000 },
];
const PRICE = { in: 2, out: 10 };

function dollars(inTokens: number, outTokens: number): string {
  const usd = (inTokens * PRICE.in + outTokens * PRICE.out) / 1_000_000;
  return usd < 0.01 ? "under $0.01" : `$${usd.toFixed(2)}`;
}

export default function AiPage() {
  return (
    <article className="measure">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@graph": [
              breadcrumbs([{ name: `How ${SITE_NAME} uses AI`, path: "/ai" }]),
              {
                "@type": "WebPage",
                name: `How ${SITE_NAME} uses AI`,
                url: `${SITE_URL}/ai`,
                description: metadata.description,
              },
            ],
          }),
        }}
      />
      <PageHeader title={`How ${SITE_NAME} uses AI`}>
        {SITE_NAME} is free, with no account. Its AI features are optional and run in your browser on your own API
        key. This page says what they do, what is sent and where, which models you can use, and what it costs you.
      </PageHeader>

      <Section id="where" title="Where AI is used">
        <div className="prose max-w-[66ch]">
          <p>
            Practice does not need AI. Choices are checked against an authored key, written answers can be
            self-assessed against the same rubric points, the playgrounds are simulations, and the model check on a
            project is deterministic code. AI is an explainer and grader on top of that.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>What it does</th>
                  <th>What is sent to your provider</th>
                </tr>
              </thead>
              <tbody>
                {FEATURES.map((feature) => (
                  <tr key={feature.name}>
                    <th>{feature.name}</th>
                    <td>{feature.what}</td>
                    <td>{feature.sent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            The review and question prompts include the list of concepts on this site, so their answers can link to
            the matching concept page. The prompts are public:{" "}
            <a href={`${SITE_REPO_URL}/tree/main/lib/ai/prompts`} className="link" rel="noopener">
              read them on GitHub
            </a>
            .
          </p>
        </div>
      </Section>

      <Section id="key" title="Your own API key">
        <div className="prose max-w-[66ch]">
          <p>
            Add a key with the key button in the header, or from any AI action. You can use a key from{" "}
            {AI_PROVIDERS.map((id, i) => (
              <span key={id}>
                <a href={PROVIDERS[id].keyUrl} className="link" rel="noopener noreferrer" target="_blank">
                  {PROVIDERS[id].label}
                </a>
                {i < AI_PROVIDERS.length - 2 ? ", " : i === AI_PROVIDERS.length - 2 ? " or " : "."}
              </span>
            ))}
          </p>
          <ul>
            <li>
              <strong>You pay your provider directly</strong>, at their prices, on your own account. {SITE_NAME} sells
              nothing, takes no cut and never sees a bill.
            </li>
            <li>
              <strong>The key stays in your browser.</strong> It is saved in this browser&rsquo;s local storage, or in
              session storage if you choose &ldquo;This tab only&rdquo;, which is cleared when the tab closes. It is
              kept apart from your progress, so exporting your data never exports the key.
            </li>
            <li>
              <strong>Requests go straight from your browser to the provider.</strong> {SITE_NAME} has no server code
              that handles AI, so the key, your text and the replies never pass through {SITE_NAME}. Anthropic asks
              browser apps to opt in to direct calls, and {SITE_NAME} does.
            </li>
            <li>
              <strong>Test key</strong> sends one free, read-only request (the provider&rsquo;s list of models, or
              OpenRouter&rsquo;s key check) and says whether the key and model work. <strong>Remove key</strong>{" "}
              deletes it from both places.
            </li>
          </ul>
          <p>
            A key saved in a browser can be read by anyone using that browser profile, and by browser extensions you
            allow to read this site. Set a monthly spending limit on the key, prefer a key you made just for{" "}
            {SITE_NAME}, and use &ldquo;This tab only&rdquo; on a shared computer.
          </p>
        </div>
      </Section>

      <Section id="models" title="Which models run">
        <div className="prose max-w-[66ch]">
          <p>
            You choose the model. Each provider&rsquo;s list starts with a balanced default, and you can type any
            other model id your provider offers. Every feature uses the model you chose.
          </p>
          <ul>
            {AI_PROVIDERS.map((id) => (
              <li key={id}>
                <strong>{PROVIDERS[id].label}:</strong> {PROVIDERS[id].models.map((m) => m.label).join(", ")}.
              </li>
            ))}
          </ul>
          <p>
            Every answer is checked against a schema before it is shown, and an answer that fails is asked for once
            more. Small, cheap models fail that check more often, especially on reviews and drafts. Each output
            records the model that produced it.
          </p>
        </div>
      </Section>

      <Section id="cost" title="What it costs you">
        <div className="prose max-w-[66ch]">
          <p>
            Nothing from {SITE_NAME}. Your provider charges for the tokens each run reads and writes. Upper bounds per
            run, at ${PRICE.in} per million input tokens and ${PRICE.out} per million output tokens (Claude Sonnet 5.5 or
            GPT-6.1 Sol prices); most runs use far less:
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Run</th>
                  <th>Reads at most</th>
                  <th>Writes at most</th>
                  <th>Costs at most</th>
                </tr>
              </thead>
              <tbody>
                {COSTS.map((row) => (
                  <tr key={row.name}>
                    <th>{row.name}</th>
                    <td>{row.inTokens.toLocaleString("en-US")} tokens</td>
                    <td>{row.outTokens.toLocaleString("en-US")} tokens</td>
                    <td>{dollars(row.inTokens, row.outTokens)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            A run that fails after the provider answered still uses tokens, and a schema retry uses them twice.
          </p>
        </div>
      </Section>

      <Section id="retention" title="Where results are kept">
        <div className="prose max-w-[66ch]">
          <ul>
            <li>
              Drafts, reviews and question sets are saved in your browser with the rest of your progress. The newest{" "}
              {MAX_AI_RUNS} are kept, they are included when you export your data, and you can delete any of them
              from <Link href="/review#standing">Review</Link>, under Your data.
            </li>
            <li>An assessment of a written answer is kept on that answer.</li>
            <li>{SITE_NAME} keeps no copy of any of it, because it never receives it.</li>
            <li>
              What you send is subject to your provider&rsquo;s own terms and data retention. OpenRouter forwards each
              request to an upstream provider, whose terms apply too.
            </li>
          </ul>
        </div>
      </Section>

      <Section id="labels" title="How AI output is labelled">
        <div className="prose max-w-[66ch]">
          <p>Every piece of AI output says what the AI did. These are the labels you will see:</p>
          <ul>
            <li>
              <AiLabel kind="draft" /> a draft the model wrote from your input.
            </li>
            <li>
              <AiLabel kind="review" /> a review of your design.
            </li>
            <li>
              <AiLabel kind="assessed" /> an assessment of a written answer.
            </li>
          </ul>
          <p>
            An AI assessment shows its basis as <code>ai-assessed</code>, next to the result. The other bases are{" "}
            <code>checked</code> (against an authored key), <code>self-assessed</code> (you marked the points) and{" "}
            <code>mixed</code>. You can always mark the points yourself instead.
          </p>
          <p>
            Draft items are marked <code>stated</code>, <code>inferred</code> or <code>guessed</code>, so you can tell
            what your text says from what the model filled in. Once you accept a draft, it is marked as AI-drafted and
            edited by you. That mark is not removed silently.
          </p>
        </div>
      </Section>

      <Section id="failures" title="When a run fails">
        <div className="prose max-w-[66ch]">
          <p>The message under the action says what went wrong, quotes the provider when it explained, and says what to try:</p>
          <ul>
            <li>
              <strong>The key is rejected</strong> (wrong, revoked, or for another provider): check it in the key
              settings and press Test key.
            </li>
            <li>
              <strong>Rate limit or quota:</strong> your provider account is out of credit or over its per-minute
              limit. Wait, or raise the limit with your provider.
            </li>
            <li>
              <strong>Model not available:</strong> the key can&rsquo;t use that model id. Pick another.
            </li>
            <li>
              <strong>Couldn&rsquo;t reach the provider:</strong> a network problem, or an extension or network filter
              blocking it.
            </li>
            <li>
              <strong>An answer we couldn&rsquo;t use:</strong> the reply failed the schema twice. Try again, or a
              stronger model.
            </li>
          </ul>
        </div>
      </Section>

      <Section id="editorial" title="AI in editorial content">
        <div className="prose max-w-[66ch]">
          <p>
            Some educational guides use AI assistance during drafting. Each such guide says so and states whether a
            person has independently reviewed it. For example, the{" "}
            <Link href="/system-design-interview/failure-scenarios" className="link">
              system design failure scenarios guide
            </Link>{" "}
            was drafted with AI assistance and has not yet had an independent human review.
          </p>
        </div>
      </Section>

      <Section id="questions" title="Questions about your data">
        <div className="prose max-w-[66ch]">
          <p>
            The <Link href="/legal/privacy" className="link">privacy policy</Link> says what {SITE_NAME} stores (very
            little) and who processes it.
          </p>
        </div>
      </Section>
    </article>
  );
}
