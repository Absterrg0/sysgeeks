"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { track } from "@/lib/analytics";

export type PracticeEntrySource =
  | "home_hero"
  | "home_playground_hero"
  | "home_mock_interview_hero"
  | "home_explorer_system"
  | "home_explorer_learn"
  | "home_explorer_playground"
  | "mock_interview_landing_hero"
  | "mock_interview_landing_browse_systems"
  | "mock_interview_landing_final_cta"
  | "question_catalog"
  | "question_catalog_playground"
  | "playground_landing_hero"
  | "playground_catalog"
  | "playground_catalog_question"
  | "interview_guide_mistake_drill"
  | "interview_guide_question_list"
  | "failure_scenarios_guide"
  | "interview_guide_final_cta";

export function PracticeEntryLink({
  href,
  investigationId,
  source,
  children,
  className,
}: {
  href: string;
  investigationId?: string;
  source: PracticeEntrySource;
  children: ReactNode;
  className: string;
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() =>
        track("practice_entry_clicked", {
          ...(investigationId ? { investigation: investigationId } : {}),
          source,
        })
      }
    >
      {children}
    </Link>
  );
}
