import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Section } from "@/components/page-header";
import { breadcrumbs, jsonLd, pageMetadata } from "@/lib/metadata";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Terms of use",
  description: `The terms for using ${SITE_NAME}: free practice, optional AI features on your own API key, and what is not promised.`,
  path: "/legal/terms",
  noindex: true,
});

export default function TermsPage() {
  return (
    <article className="measure">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@graph": [
              breadcrumbs([{ name: "Terms of use", path: "/legal/terms" }]),
              { "@type": "WebPage", name: "Terms of use", url: `${SITE_URL}/legal/terms` },
            ],
          }),
        }}
      />
      <PageHeader title="Terms of use">
        What you agree to when you use {SITE_NAME}: the free practice, and the optional AI features that run on your
        own API key.
        <br />
        <mark className="bg-highlight px-1">TODO(owner): draft for review by counsel before launch.</mark>
      </PageHeader>

      <Section id="about" title="About this service">
        <div className="prose max-w-[66ch]">
          <p>
            {SITE_NAME} is operated by <mark className="bg-highlight px-1">TODO(owner): legal entity name</mark>. The
            service is free, needs no account, and sells nothing. Support is at{" "}
            <mark className="bg-highlight px-1">TODO(owner): support email</mark>.
          </p>
        </div>
      </Section>

      <Section id="key" title="AI on your own API key">
        <div className="prose max-w-[66ch]">
          <p>
            AI features are optional. To use them you add an API key from a provider you choose. Your browser calls that
            provider directly, so your use of it is between you and the provider: its terms and prices apply, and it
            bills you. {SITE_NAME} does not charge for AI, does not receive your key, and cannot refund what your
            provider charges. You are responsible for keeping your key safe and for any spending limits on it.
          </p>
        </div>
      </Section>

      <Section id="payments" title="Payments">
        <div className="prose max-w-[66ch]">
          <p>
            {SITE_NAME} takes no payments: there are no plans, credits or subscriptions, so there is nothing to refund.
          </p>
        </div>
      </Section>

      <Section id="ai" title="AI output">
        <div className="prose max-w-[66ch]">
          <p>
            AI features produce drafts, reviews and assessments, and they can be wrong. Every AI output is labelled, and
            the{" "}
            <Link href="/ai" className="link">
              AI page
            </Link>{" "}
            explains what is sent and which models run. Treat AI output as a second opinion and check it yourself. Do not
            rely on it as the only basis for a hiring decision or a production architecture decision.
          </p>
        </div>
      </Section>

      <Section id="content" title="Your content and ours">
        <div className="prose max-w-[66ch]">
          <p>
            You keep ownership of your answers, projects and AI outputs. They are stored in your browser, not by us.
          </p>
          <p>
            Lessons, investigations and concepts are our own writing. Company writeups belong to their authors, and we
            link to the originals and credit the authors. <mark className="bg-highlight px-1">TODO(owner): licence for
            reuse of our content.</mark>
          </p>
        </div>
      </Section>

      <Section id="use" title="Acceptable use">
        <div className="prose max-w-[66ch]">
          <p>
            Do not send content you have no right to share to an AI provider through {SITE_NAME}, or use the site to
            break your provider&rsquo;s terms.
          </p>
        </div>
      </Section>

      <Section id="liability" title="Warranties and liability">
        <div className="prose max-w-[66ch]">
          <p>
            The service is provided as it is. <mark className="bg-highlight px-1">TODO(owner): warranty disclaimer and
            limitation of liability, to be drafted by counsel.</mark>
          </p>
        </div>
      </Section>

      <Section id="law" title="Governing law and changes">
        <div className="prose max-w-[66ch]">
          <p>
            <mark className="bg-highlight px-1">TODO(owner): governing law and venue.</mark> We may update these terms.
            The version on this page is the current one.
          </p>
        </div>
      </Section>
    </article>
  );
}
