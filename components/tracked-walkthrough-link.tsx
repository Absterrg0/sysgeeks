"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { track } from "@/lib/analytics";

export function TrackedWalkthroughLink({
  href,
  slug,
  placement,
  className,
  children,
}: {
  href: string;
  slug: string;
  placement: "title" | "exercise_link";
  className: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={className} onClick={() => track("walkthrough_opened", { slug, placement })}>
      {children}
    </Link>
  );
}
