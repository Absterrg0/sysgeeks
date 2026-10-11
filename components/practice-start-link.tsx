"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { track } from "@/lib/analytics";

export function PracticeStartLink({
  href,
  investigationId,
  children,
  className,
}: {
  href: string;
  investigationId: string;
  children: ReactNode;
  className: string;
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => track("practice_started", { investigation: investigationId, action: "start", source: "home_hero" })}
    >
      {children}
    </Link>
  );
}
