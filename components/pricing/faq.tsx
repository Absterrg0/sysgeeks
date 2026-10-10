import Link from "next/link";
import type { ReactNode } from "react";
import { PlusIcon } from "@/components/icons";
import { DAILY_LIMITS, FLAG_REFUNDS_PER_30_DAYS, STALE_RUN_MINUTES, WELCOME_CREDITS } from "@/lib/domain/pricing";

const FAQ: { question: string; answer: ReactNode }[] = [
  {
    question: "What is a credit?",
    answer: `A credit pays for one AI run. Each AI button shows its cost and your balance before it runs, and buying a pack shows what it pays for. New accounts get ${WELCOME_CREDITS} welcome credits once, enough for one full deep dive: a repository draft, a review and a question set.`,
  },
  {
    question: "What happens when I run out?",
    answer:
      "AI actions stop and offer a pack instead. Everything else keeps working, and nothing is charged until you choose to buy.",
  },
  {
    question: "What happens if the AI fails?",
    answer: `Its credits come back in the same response, and the page says so. That covers a provider error, a timeout, or output that fails checks after one retry. A run cut off mid-way is refunded the next time your account loads, once it is ${STALE_RUN_MINUTES} minutes old.`,
  },
  {
    question: "Do credits expire?",
    answer: "No. Packs never expire, and nothing renews. There are no subscriptions, so there is nothing to cancel.",
  },
  {
    question: "What is the refund policy?",
    answer: (
      <>
        An unused pack can be refunded in full within 14 days of purchase, as long as none of its credits have been
        used. If an AI report is wrong, the &ldquo;This is wrong about my system&rdquo; button refunds that run, up to{" "}
        {FLAG_REFUNDS_PER_30_DAYS} times in 30 days. Full terms are on the{" "}
        <Link href="/legal/refunds" className="link">
          refunds page
        </Link>
        .
      </>
    ),
  },
  {
    question: "Is learning content free?",
    answer: `Yes. Investigations, concepts, companies, practice, design rounds, mock interviews, self-assessment, progress and the model check on your projects are free, with or without an account. Assessing your written answers costs no credits either, up to ${DAILY_LIMITS.grade.free} a day (${DAILY_LIMITS.grade.purchaser} after any purchase).`,
  },
  {
    question: "Which AI model is used, and is my data used for training?",
    answer: (
      <>
        The models, and what is sent to them, are listed on the{" "}
        <Link href="/ai" className="link">
          AI page
        </Link>
        . Providers are asked not to train on prompts and, by default, to keep no data. Repository file contents are not
        stored.
      </>
    ),
  },
];

/**
 * The questions people ask before buying, each opening in place. The whole row
 * is the summary, so the click target and the focus ring are the row.
 */
export function PricingFaq() {
  return (
    <div className="sheet overflow-hidden">
      {FAQ.map((item) => (
        <details key={item.question} className="sheet-row group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 px-6 py-[1.125rem] text-[0.9375rem] font-medium text-ink transition-colors duration-150 select-none hover:bg-[color-mix(in_srgb,var(--hover)_70%,transparent)] focus-visible:rounded-[12px] focus-visible:outline-offset-[-2px] [&::-webkit-details-marker]:hidden">
            {item.question}
            <PlusIcon
              size={16}
              className="shrink-0 text-ink-3 transition-transform duration-200 group-open:rotate-45 group-open:text-ink"
            />
          </summary>
          <div className="px-6 pb-5 text-[0.875rem] leading-relaxed text-pretty text-ink-2">{item.answer}</div>
        </details>
      ))}
    </div>
  );
}
