import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Section } from "@/components/page-header";
import { breadcrumbs, jsonLd, pageMetadata } from "@/lib/metadata";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Privacy policy",
  description: `What ${SITE_NAME} stores, what is sent to AI model providers, who processes data for us, and how to delete it.`,
  path: "/legal/privacy",
});

export default function PrivacyPage() {
  return (
    <article className="measure">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@graph": [
              breadcrumbs([{ name: "Privacy policy", path: "/legal/privacy" }]),
              { "@type": "WebPage", name: "Privacy policy", url: `${SITE_URL}/legal/privacy` },
            ],
          }),
        }}
      />
      <PageHeader title="Privacy policy">
        What is stored, what is sent to AI model providers, who processes it for us, and how to delete it.
        <br />
        <mark className="bg-highlight px-1">TODO(owner): draft for review by counsel before launch.</mark>
      </PageHeader>

      <Section id="who" title="Who we are">
        <div className="prose max-w-[66ch]">
          <p>
            The controller of your data is <mark className="bg-highlight px-1">TODO(owner): legal entity name</mark>.
            Privacy questions go to <mark className="bg-highlight px-1">TODO(owner): support email</mark>.
          </p>
        </div>
      </Section>

      <Section id="collect" title="What we store">
        <div className="prose max-w-[66ch]">
          <ul>
            <li>
              <strong>Account.</strong> Your email address and sign-in details, held by Clerk, and an internal account
              ID.
            </li>
            <li>
              <strong>Credits and runs.</strong> Your credit balance and its ledger. For each AI run: the feature, the
              model, token counts, estimated cost and any error code.
            </li>
            <li>
              <strong>AI reports.</strong> The output of each run, stored under your account so you can open it again.
            </li>
            <li>
              <strong>Inputs you send.</strong> The text you submit to an AI feature, and any repository files you select
              for a draft. Repository file contents are not stored; only the list of paths and the output are kept.
            </li>
            <li>
              <strong>Purchases.</strong> The purchase record from Dodo Payments, such as the pack and payment ID. Card
              details are entered with Dodo Payments, not on this site.
            </li>
            <li>
              <strong>Learner state.</strong> Your answers, progress, projects and tailored questions are stored in your
              browser. They reach us only when you run an AI feature that sends them, such as an assessment of an answer.
            </li>
          </ul>
        </div>
      </Section>

      <Section id="processors" title="Who processes data for us">
        <div className="prose max-w-[66ch]">
          <ul>
            <li>
              <strong>Clerk</strong> for accounts and sign-in.
            </li>
            <li>
              <strong>Neon</strong> for the database, through the Vercel Marketplace.
            </li>
            <li>
              <strong>Vercel</strong> for hosting and the AI Gateway.
            </li>
            <li>
              <strong>Model providers</strong> reached through the gateway, currently Anthropic and OpenAI.
            </li>
            <li>
              <strong>Dodo Payments</strong> for payments, as merchant of record.
            </li>
            <li>
              <strong>GitHub</strong>, only when you fetch a public repository for a draft.
            </li>
          </ul>
          <p>
            <mark className="bg-highlight px-1">TODO(owner): confirm whether analytics or error monitoring is enabled,
            and list it here.</mark>
          </p>
        </div>
      </Section>

      <Section id="providers" title="Model providers">
        <div className="prose max-w-[66ch]">
          <p>
            We ask providers not to train on prompts. By default, requests are routed only to providers that keep no data
            (zero data retention). The{" "}
            <Link href="/ai" className="link">
              AI page
            </Link>{" "}
            lists the models that run for each feature.
          </p>
        </div>
      </Section>

      <Section id="retention" title="How long we keep data">
        <div className="prose max-w-[66ch]">
          <p>
            You can delete your reports and run data at any time from your account.{" "}
            <mark className="bg-highlight px-1">TODO(owner): set retention periods for the ledger, AI runs, payment
            records and deleted accounts.</mark>
          </p>
        </div>
      </Section>

      <Section id="choices" title="Your choices">
        <div className="prose max-w-[66ch]">
          <p>
            You can export your learner data as a JSON file, and import it again, from{" "}
            <Link href="/review#data" className="link">
              your progress
            </Link>
            . You can delete your AI reports from your account. To ask for anything else, including deleting your
            account, email <mark className="bg-highlight px-1">TODO(owner): support email</mark>.
          </p>
          <p>
            <mark className="bg-highlight px-1">TODO(owner): describe the rights that apply to you in your jurisdiction,
            for example under the GDPR or UK GDPR, and how to use them.</mark>
          </p>
        </div>
      </Section>

      <Section id="changes" title="Changes">
        <div className="prose max-w-[66ch]">
          <p>We will update this page when the way we process data changes.</p>
        </div>
      </Section>
    </article>
  );
}
