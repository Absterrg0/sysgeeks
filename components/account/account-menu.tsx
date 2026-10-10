"use client";

import { ClerkLoading, Show, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import type { ReactNode } from "react";

export function AccountMenu({ auth, credits }: { auth: boolean; credits?: ReactNode }) {
  if (!auth) return null;
  return (
    <>
      <ClerkLoading>
        <span className="skeleton inline-block h-[1.875rem] w-28" aria-hidden="true" />
      </ClerkLoading>
      <Show when="signed-out">
        <Link href="/sign-in" className="btn btn-ghost btn-sm">
          Sign in
        </Link>
        <Link href="/sign-up" className="btn btn-accent btn-sm hidden sm:inline-flex">
          Sign up
        </Link>
      </Show>
      <Show when="signed-in">
        {credits}
        <UserButton />
      </Show>
    </>
  );
}
