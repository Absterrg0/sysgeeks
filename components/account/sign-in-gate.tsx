"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { FeatureUnavailable } from "@/components/account/feature-unavailable";
import { Skeleton } from "@/components/feedback";
import { useAccount } from "@/lib/client/account";
import { WELCOME_CREDITS } from "@/lib/domain/pricing";

/** Wraps an AI action. Signed-out visitors see a sign-in prompt in its place. */
export function SignInGate({ children }: { children: ReactNode }) {
  const { data, loading } = useAccount();
  if (!data) return loading ? <Skeleton lines={1} /> : <SignInPrompt />;
  if (!data.features.ai) return <FeatureUnavailable />;
  if (!data.signedIn) return <SignInPrompt />;
  return <>{children}</>;
}

function SignInPrompt() {
  return (
    <div className="panel flex flex-wrap items-center justify-between gap-3 p-4">
      <p className="text-ui text-ink-2">Sign in to use AI features ({WELCOME_CREDITS} free credits)</p>
      <Link href="/sign-in" className="btn btn-primary btn-sm">
        Sign in
      </Link>
    </div>
  );
}
