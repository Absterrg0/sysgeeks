import type { ReactNode } from "react";
import { AccountNav } from "@/components/account/account-nav";
import { PageHeader } from "@/components/page-header";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({
  title: "Account",
  description: "Your credit balance, AI runs and saved data.",
  path: "/account",
  noindex: true,
});

export const dynamic = "force-dynamic";

export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <PageHeader title="Account">Your credits, the AI runs saved to your account, and your data.</PageHeader>
      <div className="flex flex-col gap-8 pt-8 md:flex-row md:gap-14">
        <AccountNav />
        <div className="min-w-0 flex-1 pb-16">{children}</div>
      </div>
    </div>
  );
}
