import type { Metadata } from "next";
import Link from "next/link";
import { AiLabel } from "@/components/ai";
import { PageHeader, Section } from "@/components/page-header";
import {
  DAILY_LIMITS,
  FLAG_REFUNDS_PER_30_DAYS,
  PACKS,
  STALE_RUN_MINUTES,
  WELCOME_CREDITS,
  creditCost,
} from "@/lib/domain/pricing";
import { breadcrumbs, jsonLd, pageMetadata } from "@/lib/metadata";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: `How ${SITE_NAME} uses AI`,
  description:
    `See what ${SITE_NAME} shares with AI providers, which models it uses, how long data is kept, how outputs are labelled, and when credits are refunded.`,
  path: "/ai",
});

const credits = (n: number) => (n === 0 ? "No credits" : `${n} ${n === 1 ? "credit" : "credits"}`);

const FEATURES = [
  {
    name: "Assessment of a written answer",
    what: "Assesses your written answer against the rubric points of its question. Every assessment quotes the sentence it relied on, and the server rejects a quote it cannot find in your answer.",
    cost: `${credits(creditCost("grade"))}, up to ${DAILY_LIMITS.grade.free} a day`,
  },
  {
    name: "Draft from a description or README",
    what: "Drafts a project’s architecture from text you give it.",
    cost: credits(creditCost("intake", { source: "readme" })),
  },
  {
    name: "Draft from a public GitHub repository",
    what: "Drafts a project’s architecture from the files you choose in a public repository.",
    cost: credits(creditCost("intake", { source: "repository" })),
  },
  {
    name: "Architecture review",
    what: "Reviews a project’s architecture and reports what it finds.",
    cost: credits(creditCost("review")),
  },
  {
    name: "Tailored question set",
    what: "Writes 8 to 12 questions about your own design, covering trade-offs that the standard questions cannot know about.",
    cost: credits(creditCost("questions")),
  },
];

const PACK_PRICES = PACKS.map((pack) => `${pack.credits} credits for $${pack.priceUsd}`).join(", ");

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
        Most of {SITE_NAME} works without an account or AI. AI is an optional feature for signed-in users. This page
        says what it does, what is sent, which models run, how long data is kept, how its output is labelled, and when
        credits come back.
      </PageHeader>

      <Section id="where" title="Where AI is used">
        <div className="prose max-w-[66ch]">
          <p>
            Free practice does not use AI. Choices are checked against an authored key, written answers can be
            self-assessed, and the model check on a project is deterministic code. None of these need an account.
          </p>
          <p>
            Signed-in users can also run the features below. Each one shows its credit cost, and your balance after it,
            before it runs. There are no subscriptions, no automatic top-ups and no recurring charges.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>What it does</th>
                  <th>Cost</th>
                </tr>
              </thead>
              <tbody>
                {FEATURES.map((feature) => (
                  <tr key={feature.name}>
                    <th>{feature.name}</th>
                    <td>{feature.what}</td>
                    <td>{feature.cost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Not available yet: an AI interviewer that asks follow-up questions in a mock interview. It is planned for a
            later phase.
          </p>
        </div>
      </Section>

      <Section id="sent" title="What is sent">
        <div className="prose max-w-[66ch]">
          <ul>
            <li>
              <strong>Your text.</strong> The answer being assessed, or the description or README you give for a draft,
              is sent when you run that feature.
            </li>
            <li>
              <strong>Repository files.</strong> You see the files before the run starts, and only the files you select
              are sent. <code>.env</code> files (other than <code>.env.example</code>) and <code>*.pem</code> and{" "}
              <code>*.key</code> files are never fetched. Values that look like secrets, such as AWS keys, GitHub and
              Slack tokens, private key blocks and <code>password=</code>-style assignments, are replaced with{" "}
              <code>[REDACTED]</code> first. Matching works by pattern, so it can miss a secret. Do not select files you
              would not share.
            </li>
            <li>
              <strong>An account identifier.</strong> Each request carries an internal account ID, which is used to
              attribute its cost.
            </li>
          </ul>
        </div>
      </Section>

      <Section id="models" title="Which models run">
        <div className="prose max-w-[66ch]">
          <p>
            AI calls go through Vercel’s AI Gateway. Each feature has a primary model and a fallback from another
            provider, which runs if the primary fails.
          </p>
          <ul>
            <li>
              <strong>Drafts, architecture reviews and question sets:</strong> Claude Sonnet 5.5, with GPT-6.1 Sol as
              the fallback.
            </li>
            <li>
              <strong>Assessments of written answers:</strong> Claude Haiku 5.5, with GPT-6 Luna as the fallback.
            </li>
          </ul>
          <p>
            Each AI output records the model that produced it. Models can change, and the model named on a report is
            the one that ran.
          </p>
        </div>
      </Section>

      <Section id="retention" title="How long data is kept">
        <div className="prose max-w-[66ch]">
          <ul>
            <li>Repository file contents are not stored. Only the list of file paths and the output are kept.</li>
            <li>
              Each run keeps its output, the model, token counts, estimated cost and any error code. AI reports are
              stored under your account, so you can open them on another device.
            </li>
            <li>
              Your learner state, meaning your answers, progress, projects and tailored questions, stays in your
              browser. Syncing it to our servers is not available yet.
            </li>
            <li>
              Providers are asked not to train on prompts. By default, requests are routed only to providers that keep
              no data (zero data retention).
            </li>
            <li>You can delete your reports and run data at any time from your account.</li>
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
          <p>Each report carries a line like this:</p>
          <blockquote>
            <p>
              AI-generated by {"{model}"} on {"{date}"} from {"{inputs}"}. It can be wrong; low-confidence items are
              guesses.
            </p>
          </blockquote>
          <p>
            Draft items are marked <code>stated</code>, <code>inferred</code> or <code>guessed</code>, so you can tell
            what your text says from what the model filled in. Once you accept a draft, it is marked as AI-drafted and
            edited by you. That mark is not removed silently.
          </p>
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

      <Section id="limits" title="Credits and limits">
        <div className="prose max-w-[66ch]">
          <ul>
            <li>
              Welcome credits: {WELCOME_CREDITS}, granted once after your email address is verified.
            </li>
            <li>
              Packs are one-time purchases: {PACK_PRICES}. Credits never expire. The{" "}
              <Link href="/#pricing" className="link">
                home page
              </Link>{" "}
              lists them in full.
            </li>
            <li>
              Assessments are limited to {DAILY_LIMITS.grade.free} a day, or {DAILY_LIMITS.grade.purchaser} a day after
              any purchase. Drafts, reviews and question sets are limited to {DAILY_LIMITS.review.free} runs a day each.
            </li>
            <li>
              There is a daily cap on estimated model spend. Passing it pauses free assessments, and passing three times
              it pauses all AI. The cap resets each day.
            </li>
          </ul>
        </div>
      </Section>

      <Section id="refunds" title="When a run fails or is wrong">
        <div className="prose max-w-[66ch]">
          <ul>
            <li>
              <strong>Failed runs.</strong> If the provider errors, the run times out, or the output is still invalid
              after one retry, the credits come back in the same response, and the page says so.
            </li>
            <li>
              <strong>Runs that stop unexpectedly.</strong> If a run is cut off before it finishes, its credits come back
              the next time your account loads, once the run is {STALE_RUN_MINUTES} minutes old.
            </li>
            <li>
              <strong>“This is wrong about my system.”</strong> Every report and question set has this button. It
              refunds that run’s credits straight away. Each run can be flagged once, and an account can flag up to{" "}
              {FLAG_REFUNDS_PER_30_DAYS} runs in any 30 days. Beyond that, email support.
            </li>
            <li>
              <strong>Purchases.</strong> A pack with no credits used can be refunded within 14 days of purchase. The{" "}
              <Link href="/legal/refunds" className="link">
                refunds policy
              </Link>{" "}
              has the details.
            </li>
          </ul>
        </div>
      </Section>

      <Section id="questions" title="Questions about your data">
        <div className="prose max-w-[66ch]">
          <p>
            The <Link href="/legal/privacy" className="link">privacy policy</Link> covers who processes data and how to
            ask for it to be deleted.
          </p>
        </div>
      </Section>
    </article>
  );
}
