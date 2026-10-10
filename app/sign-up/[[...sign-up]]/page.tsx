import type { Metadata } from "next";
import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { features } from "@/lib/config";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Sign up",
  robots: { index: false },
};

export default function SignUpPage() {
  if (!features().auth) {
    return <p className="py-16 text-center text-ink-2">Accounts aren&apos;t enabled on this deployment.</p>;
  }
  return (
    <section className="bleed dotgrid flex flex-col items-center gap-6 py-16">
      <header className="text-center">
        <Link href="/" className="font-display text-lede">
          {SITE_NAME}
        </Link>
        <p className="mt-2 text-ink-2">Sign in to save progress across devices and use AI features.</p>
      </header>
      <div className="w-full max-w-[26rem]">
        <SignUp />
      </div>
      <p className="text-small text-ink-3">Everything except AI features works without an account.</p>
    </section>
  );
}
