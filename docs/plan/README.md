# Overhaul plan: how the two specs fit together

- `architecture.md`: product, AI, auth, billing, data and example projects. Tasks A1–D8, X02–X12.
- `design.md`: visual system ("Graphite & Citron"). Tasks T1–T14.

## Precedence where they overlap
- **Behaviour, data, routes, file locations:** architecture.md wins.
- **Look and feel:** design.md wins. New UI follows design.md §5 component specs and §6 page notes. This overrides the architecture.md rule "use existing primitives as placeholders".
- **Pricing data** lives in `lib/domain/pricing.ts` (architecture A2). Design T8's `lib/pricing.ts` is not created. The pricing page renders from `PACKS` / `creditCost`.
- **Account pages:** architecture D6 builds them using design T9's sub-nav and layout. Design T9 is folded into D6, and there is no fixture file.
- **Project workspace:** architecture D2/D3/D4 build the real flow styled per design §6. Design T11's fixture-driven shell is skipped; the T11 restyle of the existing workspace and model editor still happens.
- **AI and billing visual primitives:** design T3 creates `components/ai.tsx`, `components/feedback.tsx` and `components/billing-ui.tsx`. Architecture D1's `components/ai/*` and `components/account/*` compose those primitives and don't restyle them.
- **Sign-in pages:** architecture B2 creates them, styled per design §6 "Sign-in" and §8 (Clerk appearance). Design T14 is folded into B2.

## Rules for every implementation task
- Next.js 16 differs from your training data. Check `node_modules/next/dist/docs/` before using routing, proxy or caching APIs.
- Use pnpm. Only task A1 adds dependencies, unless your task says otherwise.
- Don't commit, and don't run git commands that change state.
- Other agents edit other files at the same time. Fix errors only in files your task owns. If typecheck fails elsewhere, report it rather than editing that file.
- `pnpm build` must pass with no env vars.
- Read only the plan sections your task points to.

## Follow-ups (coordinator)
- T12b: thumbnails in `components/investigation/investigation-index.tsx` sit in 4:3 wells; restyle the concept detail page `app/concepts/[conceptId]/page.tsx` (design §6).
- D5: show the "assessed by AI" label in the exercise evidence summary (`components/exercise/*`).
- D3: the source chip in `project-workspace.tsx` (~line 79) needs variants for manual, description and repository sources.
- B2 gap: the Clerk appearance has no dark theme. Recent Clerk versions accept CSS `var()` in `appearance.variables`, so try `var(--ink)` and similar tokens. Sign-in with real keys is untested.
- D1: `CreditsChip` and the header `credits` prop require `allotment`, but credit packs have no allotment. Make it optional and show the balance only.
- D7: add Privacy, Terms, Refunds and Contact links to the footer once the legal pages exist.
- D4: `project-workspace.tsx` (~line 319) must pass `project` into the ExerciseSpec. Until it does, AI grading of project questions fails.
