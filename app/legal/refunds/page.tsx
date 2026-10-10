import type { Metadata } from "next";
import { PageHeader, Section } from "@/components/page-header";
import { FLAG_REFUNDS_PER_30_DAYS, STALE_RUN_MINUTES } from "@/lib/domain/pricing";
import { breadcrumbs, jsonLd, pageMetadata } from "@/lib/metadata";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Refunds",
  description: `When ${SITE_NAME} credits come back automatically, how to flag a wrong AI report, and how to refund an unused pack.`,
  path: "/legal/refunds",
});

export default function RefundsPage() {
  return (
    <article className="measure">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@graph": [
              breadcrumbs([{ name: "Refunds", path: "/legal/refunds" }]),
              { "@type": "WebPage", name: "Refunds", url: `${SITE_URL}/legal/refunds` },
            ],
          }),
        }}
      />
      <PageHeader title="Refunds">
        Credits are bought in one-time packs and never expire. This page says when they come back, and how a purchase
        can be refunded.
        <br />
        <mark className="bg-highlight px-1">TODO(owner): draft for review by counsel before launch.</mark>
      </PageHeader>

      <Section id="failed" title="Failed runs are refunded automatically">
        <div className="prose max-w-[66ch]">
          <p>
            If a provider errors, a run times out, or the output is still invalid after one retry, the run’s credits come
            back in the same response. The page says so when it happens.
          </p>
        </div>
      </Section>

      <Section id="stopped" title="Runs that stop unexpectedly">
        <div className="prose max-w-[66ch]">
          <p>
            If a run is cut off before it finishes, its credits come back the next time your account loads, once the run
            is {STALE_RUN_MINUTES} minutes old.
          </p>
        </div>
      </Section>

      <Section id="wrong" title="“This is wrong about my system”">
        <div className="prose max-w-[66ch]">
          <p>
            Every AI report and tailored question set has this button. It refunds that run’s credits straight away. Each
            run can be flagged once, and an account can flag up to {FLAG_REFUNDS_PER_30_DAYS} runs in any 30 days. Beyond
            that, email support.
          </p>
        </div>
      </Section>

      <Section id="purchases" title="Purchases">
        <div className="prose max-w-[66ch]">
          <p>
            A pack can be refunded in full within 14 days of purchase, as long as none of its credits have been used.
            Refunds are issued through Dodo Payments. When a pack is refunded, only the credits from it that are still
            unspent are removed from your balance.
          </p>
        </div>
      </Section>

      <Section id="ask" title="How to ask">
        <div className="prose max-w-[66ch]">
          <p>
            Email <mark className="bg-highlight px-1">TODO(owner): support email</mark> from the address on your account,
            and say which run or purchase you mean.
          </p>
        </div>
      </Section>

      <Section id="welcome" title="What is not refunded">
        <div className="prose max-w-[66ch]">
          <p>
            Welcome credits were never paid for, so they are not refunded. The policy above is issued by{" "}
            <mark className="bg-highlight px-1">TODO(owner): legal entity name</mark>.
          </p>
        </div>
      </Section>
    </article>
  );
}
