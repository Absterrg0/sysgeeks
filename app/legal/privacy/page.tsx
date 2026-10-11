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
            <li>
              <strong>Analytics and performance.</strong> Vercel Web Analytics records page views and daily visitor
              counts on public pages, along with page URL and route, referrer, timestamp, location, device, operating
              system and browser summaries. Vercel says Web Analytics does not use cookies and its visitor hash expires
              after 24 hours. Vercel Speed Insights records page performance measurements, such as loading and
              interaction metrics, along with page URL and route, network speed, browser, device, operating system and
              country. Both tools exclude sign-in and sign-up pages, account pages, saved reports, interview sessions
              and private project URLs. The site sends these explicit events to Vercel Web Analytics and, if configured,
              PostHog: practice_entry_clicked, practice_started, resource_download_clicked, share, answer_submitted,
              design_round_saved, mock_interview_started, mock_interview_completed, llm_capacity_estimator_used and
              content_feedback.
              The practice_entry_clicked event records which public exercise link was selected and its source label.
              The practice_started event records the exercise, whether someone started or continued it, and the
              short label for the start control. The content_feedback event records only a yes/no response and public
              page route, not written feedback. The calculator event records that the tool was used, not values
              entered. The resource_download_clicked event records a fixed label for the public PDF link selected, not
              file contents. Events include only the event name and limited context such as public route, exercise,
              interview length, focus and question count; answer text and private project content are not sent. PostHog uses
              session storage for an anonymous identifier that lasts for the browser tab session. Autocapture and
              session recordings are disabled, and the site does not identify visitors by account or email. PostHog
              may process an IP address, referrer and browser/device details; its project settings can be configured
              to discard IP addresses. The site also sends PostHog a request event when a public page is requested
              with a user-agent string matching a known search or AI crawler. That event contains the public path,
              hostname, request method, user-agent string and a derived crawler name/category; it omits query strings,
              referrer, the crawler&apos;s IP
              address, cookies and account data, and is configured not to create a person profile or GeoIP data.
              User-agent matching is a heuristic and can be spoofed.
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
              <strong>Vercel</strong> for hosting, Web Analytics, Speed Insights and the AI Gateway.
            </li>
            <li>
              <strong>PostHog</strong> for anonymous product analytics, only when a project key is configured.
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
            Read{" "}
            <a
              href="https://vercel.com/docs/analytics/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="link"
            >
              Vercel Web Analytics privacy details
            </a>{" "}
            and{" "}
            <a
              href="https://vercel.com/docs/speed-insights/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="link"
            >
              Vercel Speed Insights privacy details
            </a>{" "}
            and{" "}
            <a href="https://posthog.com/docs/privacy" target="_blank" rel="noopener noreferrer" className="link">
              PostHog privacy controls
            </a>{" "}
            for details about how these providers handle data.
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
