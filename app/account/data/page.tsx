import Link from "next/link";
import { Section } from "@/components/page-header";
import { DataControls } from "@/components/understanding/data-controls";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({
  title: "Data",
  description: "Export or import your learner progress, and see where each kind of data is kept.",
  path: "/account/data",
  noindex: true,
});

/** Learner progress lives in this browser, so this page works with or without an account. */
export default function AccountDataPage() {
  return (
    <div className="space-y-12">
      <Section id="this-browser" title="This browser">
        <DataControls />
      </Section>
      <Section id="account" title="Your account">
        <p className="max-w-[62ch] text-[0.875rem] leading-relaxed text-ink-2">
          When you are signed in, the output of each AI run is saved to your account, so you can open it on another
          device. You can delete any saved output from{" "}
          <Link href="/account/runs" className="link">
            Usage and runs
          </Link>
          . Deleting an output does not change your progress in this browser.
        </p>
      </Section>
    </div>
  );
}
