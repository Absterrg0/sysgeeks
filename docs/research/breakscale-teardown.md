# Breakscale teardown, and what sysgeeks should do about it

Researched 2026-11-12. I used breakscale.tech hands-on in Chrome at 1440×900 and 390×844, in light and dark, and read its public discussion. Then I looked at sysgeeks the same way. Production sysgeeks.com was returning `503 DEPLOYMENT_PAUSED` that day, so the sysgeeks notes come from `main` (568e3f7) running locally, plus the code. Screenshots are in [`breakscale-teardown/`](breakscale-teardown/).

## In one paragraph

Breakscale is good. It's a free, open-source canvas: you wire parts together, drag a traffic slider, and a discrete-event simulation shows latency percentiles, queues and failures. It has a tour, a 36-step learning path with pass/fail challenges, a chaos mode and a glossary. Its weaknesses are in what it teaches, not in how it looks:

- Magnitudes are toy-sized and nothing is sourced. Its "Twitter" runs at 330 requests a second, with a celebrity who has 200 followers.
- Some knobs teach things that aren't true. The tour's fix for a saturated database is to raise how many requests it works on at once, and that doubles throughput.
- Its numbers are random and time-based, so the screen disagrees with itself, and a challenge verdict takes a minute of simulated runs.
- Passing a challenge ends with "Met", not with what the fix cost or how real teams handled it.
- Nothing in it carries over to an interview.

sysgeeks already had the harder part: a deterministic model of every curated system, with numbers taken from each system's brief, tied to concepts and to real engineering writeups. It had no situations to get through, no goals, and no payoff. Its model also had four correctness errors of the same kind breakscale is criticised for. This branch fixes those and adds grounded, instantly checked scenarios with a cited debrief, which come back in Review.

## 1. Breakscale: what it is

**Core loop.** Open the page, which is one canvas with no account. Drag *Offered load*, watch a part fill up ("99.9% busy", "47 waiting"), change it, and watch p99 recover. A four-step tour teaches exactly that, using a client → API → database example ([bs-home](breakscale-teardown/bs-home.jpg), [bs-tour3](breakscale-teardown/bs-tour3.jpg)).

**Around the loop:**

- 33 component types: traffic, compute, data, specialised stores, messaging, and control (rate limiter, load shedder, circuit breaker, bulkhead, autoscaler, region).
- An inspector per part with "Break it on purpose": crash, slow ×N, glitch N%.
- A learning path of 36 examples and challenges in 7 groups, from first bottlenecks to "Real systems": Discord, Uber, Netflix, Spotify, Twitter and Stripe ([bs-path](breakscale-teardown/bs-path.jpg)).
- "Can you break it?": chaos mode with a single-point-of-failure list ([bs-break](breakscale-teardown/bs-break.jpg)).
- A 105-term glossary page, share links, and an MCP server and VS Code extension.
- MIT-licensed, about 2,000 GitHub stars, React + Vite, entirely client-side.

**What works, and sysgeeks should respect it:**

- Time to first insight is under a minute, and the tour's "set it to 300 → something filled up → show me the fix" is a well-built first loop.
- Percentiles and queueing come out of the simulation instead of being painted on. p99 rising while p50 stays flat is shown, not asserted.
- Plain-language definitions are everywhere (hover any term), and the inspector explains its own formula: "Most it can finish 400/s = 12 at once ÷ 30ms each".
- A "what just happened" event log ties cause to effect: "You raised the load from 50 to 300 a second" → "Database started turning away 107 a second".
- Challenges have explicit goals ("p99 ≤ 250 ms, lose ≤ 1 in 100") and constraints ("You can't add a single slot").
- It works at 390 px with a bottom tab bar, and it has a dark theme.

## 2. Where breakscale fails learners (with evidence)

| # | Failure | Evidence | Why it matters |
|---|---|---|---|
| B1 | **Toy magnitudes, and "real systems" that aren't sourced.** The load slider tops out at 5k req/s. The Twitter example runs 330 req/s in total, and its note says a celebrity tweet "becomes 200 fan-out jobs", each "about 120ms", with "only eight" running at once. The page has no citations at all: the only outbound link is to the GitHub repo. | [bs-twitter](breakscale-teardown/bs-twitter.jpg); a scan of every `<a>` on the Stripe example found one off-site link, `github.com/workersio/breakscale`. | Interviews test orders of magnitude: 300k timeline reads a second, millions of followers, sub-millisecond cache writes. A learner who plays the "Twitter" example comes away with the wrong scale and no way to check it. |
| B2 | **Knobs that teach things that aren't true.** The tour's fix for a saturated database is "Raise Slots per instance from 6 to 12", and capacity goes from 200/s to 400/s ("12 at once ÷ 30ms each"). Real databases are bounded by cores and I/O, and past that point more concurrency adds contention rather than throughput. A write-lock wait parameter softens this only for writes. Its own issue tracker confirms more cases: chained caches compound "independent coin flips" (#31), load-balancer capacity settings are "all inert" (#52), and a node losing 26% of requests to timeouts showed "0% failing" (#51). | [bs-tour3](breakscale-teardown/bs-tour3.jpg); GitHub issues #31, #51, #52. | The very first lesson rewards the knob, not the remedies you would use: cache, replicas, cheaper queries, sharding. |
| B3 | **The screen disagrees with itself.** In the "Checkout rush" challenge, at the same moment, the header said *System p99 217ms* while the challenge panel said *Slowest 1 in 100 took 629ms*. Offered load was 500/s, the client "sent 441/s", goodput was 454/s, and errors and drops were both 0. The panel's own explanation: "These numbers move with the run on screen. Only the check decides a pass." | [bs-checkout](breakscale-teardown/bs-checkout.jpg) | Stochastic, time-windowed numbers make before/after comparison guesswork. The learner has to trust a check they can't see. |
| B4 | **Slow verdicts.** "The check plays your design 3 times, each with slightly different random traffic. It counts from 15s to 60s of each run." | Challenge details panel. | Every hypothesis costs a minute of simulated time, which works against trying ideas. |
| B5 | **Pass/fail with no payoff.** Passing a challenge flips goals to "Met". It doesn't say what the fix cost (money, staleness, complexity), how the named company actually handled it, or what to say about it. | Challenge panel. | The trade-off is the lesson. Without it a learner can pass by trying knobs and learn nothing that transfers. |
| B6 | **A sandbox that teaches people who already know.** Users asked for suggested fixes and challenge modes. One wrote: "an amazing tool for users who know how to properly design systems. If its someone learning they don't always know how to solve the bottlenecks" (#23). The creator agreed: "the sandbox teaches whoever already knows what to try" (#27). Users also asked for budgets so you can't "autoscale to hell" (#27). | GitHub issues #23, #27. | Hints exist now, but they're generic ("Something here is full and something is idle"). |
| B7 | **No route to the interview.** It has no requirements, no estimation, no explaining or defending a design, and no spaced review. Progress is a local checklist. | Whole product. | People come to system design to pass interviews. A sandbox alone doesn't train saying the trade-off out loud. |
| B8 | **Nothing is linkable or indexable.** Opening an example or a challenge leaves the URL at `https://breakscale.tech/`. The sitemap lists 3 URLs: home, glossary and privacy. Share links encode the whole design, and users complained they're too long. | Address bar after opening "Checkout rush"; `/sitemap.xml`; issues #53/#55. | A teacher or friend can't send "try the retry-storm example". Search engines see one page. |
| B9 | **Accessibility of the core.** The main diagram has no role or label, and the page has no live regions (`aria-live` count 0), so a screen reader hears nothing when a part saturates. Nodes are focusable. At phone width the fitted canvas makes node numbers unreadable. | DOM probe; [bs-mobile-dark](breakscale-teardown/bs-mobile-dark.jpg). | The canvas is the product, and it's a visual-only experience. *(From an automated probe, not a full audit.)* |

**Public discussion.** There's very little outside GitHub. Hacker News has three 2-point link posts with no substantive comments (items 49488177, 49522565, 49627109). A Vercel community showcase post has no replies. I found no Reddit, Product Hunt, dev.to or Indie Hackers threads. Reddit search was blocked, so a thread there can't be ruled out. The signal is in the 29 GitHub issues. The two recurring themes are simulation correctness (#26, #29, #31, #51, #52, #96) and weak teaching for beginners (#23, #27). The repository is about three months old and spread mostly through GitHub trending.

## 3. sysgeeks today, set against it

| | Breakscale | sysgeeks (`main`) |
|---|---|---|
| Unit of learning | A canvas plus examples | A real system: Learn · Play · Interview · Walkthrough |
| Simulation | Discrete-event, random, p50/p95/p99 | Analytical and deterministic; mean wait, availability, utilisation, backlog |
| Numbers | Toy, unsourced | From each system's brief ("10 billion redirects a month"), with assumptions marked |
| Grounding | None | 40+ primary writeups (`lib/content/sources.ts`), linked from insights |
| Editing | Free-form canvas, 33 parts | Constrained: size a part, put an LB/CDN/cache/queue/limiter in front, kill, remove |
| Goals | 36 examples and challenges, pass/fail | **None**: free play only |
| After a change | Event log | "What your changes did" (gain/cost/risk) with concepts and sources |
| Interview transfer | None | Stages, mock interview, Review with spaced repetition |
| Linkable | One URL | Static page per system playground |

**sysgeeks had the same class of bug as B2.** Reading `simulate()`, I found four places where the model taught something false:

1. A read replica didn't remove a database's single point of failure.
2. Splitting a database into shards with no replicas *raised* availability (99.95% became 99.9999%) and cleared the single-point-of-failure flag.
3. Killing one of four unreplicated shards lost nothing. Really, a quarter of requests have nowhere to go.
4. Two caches in a row compounded: two 90% caches let 1% of reads through, though the second only ever sees the first's misses. This is breakscale's #31.

There was also no way to make a part *slow*, only dead.

Other gaps:

- The playground had no situation, no goal and no finish line. After a learner has clicked around, there's nothing pulling them back.
- The Review page knew nothing about the playground.
- Header and layout were fine, but the page told people "nothing is graded" and then offered nothing to aim at.

## 4. What to build, in priority order

Each item is ranked by how much it improves what a learner can do afterwards, within the owner's constraints: no new top-level sections, playground over grading, deterministic core with AI optional, and the dark-first "live system" design.

| P | Improvement | Learner value | Status |
|---|---|---|---|
| **P1** | **Fix the model's false lessons** (replicas vs shards, failover, partial shard loss, stacked caches) and add a *slow* fault. | A simulator that teaches a falsehood is worse than none. This is the one place sysgeeks clearly beat breakscale on correctness, and it wasn't true yet. | **Built** |
| **P2** | **Scenarios in Play.** Real situations per system, using its real workload: a campaign landing, a CDN purge, a provider slowing 8×, a primary dying, a shard dying, traffic tripling, an SDK double-sending. Each has explicit goals: failing ≤ X, wait ≤ Y, keeps up, budget ≤ N, or *survives fault F*, with the fault injected on top of the learner's own design. | Gives the sandbox a direction (B6) without turning it into grading. Budgets stop the "add instances until green" non-answer. Surviving-a-fault goals teach resilience you can't fake by adding capacity. | **Built**: 8 scenarios, 5 systems |
| **P3** | **Instant, deterministic verdicts** that show the measured value, the target, and where it fails. | Fixes B3 and B4. Change one thing and see exactly what moved, every time. | **Built** |
| **P4** | **A debrief that is the payoff**: what it cost, how the real system handled it (cited), the interview sentence, and what the model leaves out. | Fixes B5 and B7. The learner leaves with the trade-off and a sentence to say, not a green tick. Being honest about limits keeps the model from becoming a source of new myths (B1/B2). | **Built** |
| **P5** | **Help in steps**: hints that point at parts, then one answer described in words. | Fixes B6 for beginners without giving the answer away first. | **Built** |
| **P6** | **Scenarios come back in Review**: solve again from a blank start after 3, 10 and 30 days, plus untried ones. | Retrieval practice on design moves, not just facts. Attached to Review, so no new section. | **Built** |
| **P7** | **Every scenario has an address** (`/investigations/<id>/playground#scenario=<id>`), and titles render in the statically generated page. | Fixes B8. Shareable, and adds no per-request server work. | **Built** |
| **P8** | **Accessibility**: goal status announced through a live region, scenario switch as pressed buttons, frozen controls explained via `aria-describedby`. | Partial fix for B9 on our side. | **Built** (goals); map narration deferred |
| P9 | **Play tab for Your systems**, with their own traffic numbers: operations, rates, and paths through their parts. | Breakscale's real strength is "build *your* system and load it". This is the known open gap, and the next highest-value piece. | Deferred: needs a traffic editor and the Design-tab move to the playground editor |
| P10 | **Tail latency**: add a deterministic p99 estimate per operation (M/M/c / Erlang-C) next to the mean wait. | Interviews talk in p99, and breakscale shows it. It must stay deterministic and be honest that it's an approximation. | Deferred |
| P11 | **Scenarios for the remaining systems** (rate limiter fail-open/closed, notification bulkheads, Discord hot partitions, Convex single committer). | Several need model features first: per-client limits, per-pool workers, skew. Doing them without those features would recreate B2. | Deferred, with notes in `lib/content/scenarios.ts` |
| P12 | **AI explainer aware of the scenario.** The existing explainer already receives the scenario's design and traffic. A next step is to let it cite the scenario's own sources. | Optional and labelled, per the owner's constraint. | Partial |

## 5. What was not copied

Breakscale's names, copy, layout and flows weren't reused. There's no canvas, no tour, no "learning path" or "challenge" naming, and no chaos mode. Scenarios live inside each system's existing Play tab and reuse its screen, plate and inspector patterns. They're checked by sysgeeks' own analytical model and grounded in sysgeeks' existing source library.
