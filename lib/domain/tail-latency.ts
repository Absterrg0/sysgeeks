/**
 * Tail latency for the playground, worked out instead of sampled, so the same design always gives the same p99.
 *
 * The model treats every part a caller waits on as a queue:
 *
 * - Requests arrive at random (a Poisson stream) and each instance works through its own queue, one request at
 *   a time on average, with exponentially distributed work: the M/M/1 queue. Its time in that part (waiting plus
 *   being served) is then exponential with mean `latency / (1 − utilization)`, which is the average the
 *   playground has always shown.
 * - A part a provider runs (a CDN, a managed object store, a third-party API) scales out instead of queueing,
 *   so its time is exponential around its normal latency.
 * - For queues in series, a request's times at the successive parts are independent (Reich, 1957; it follows
 *   from Burke's output theorem), so its end-to-end time is a sum of independent exponentials.
 * - A cache or CDN that answers a request ends its trip early, so an operation's time is a mixture of
 *   branches, one per place a request can stop, weighted by the share that stops there.
 * - A fixed delay, such as a round trip between regions, shifts a branch without spreading it.
 *
 * Under those assumptions the percentile is exact up to the numerical grid used below (well under 1%). The
 * assumptions are the approximation: real service times are rarely exponential, and real queues are bounded,
 * so a part over capacity has no steady state. Callers mark that case instead of reporting a number.
 *
 * Pure and client-safe.
 */

/** One part on a request's trip: an exponential time with this mean, or a fixed delay. */
export type Stage = { meanMs: number } | { fixedMs: number };

/** Requests that take one particular trip, and the share of all requests that take it. */
export type Branch = { weight: number; stages: Stage[] };

/** Points on each branch's grid. 4,000 keeps the p99 within about 0.2% of the exact value. */
const POINTS = 4_000;
/** How far the grid reaches, in multiples of a branch's total exponential mean. The tail beyond is below 1e-8. */
const REACH = 25;

type Curve = {
  /** Fixed delay before anything can finish. */
  shift: number;
  dt: number;
  /** Probability the trip has finished by `shift + i·dt`. */
  cdf: Float64Array;
};

/**
 * `(1 − e^{−x}(1 + x)) / x`, the weight a linear step in the input gets when convolved with an exponential over
 * one grid step of `x = λ·dt`. Written so that it stays accurate for tiny `x`.
 */
function rampWeight(x: number): number {
  if (x < 1e-4) return x / 2 - (x * x) / 3 + (x * x * x) / 8;
  return (-Math.expm1(-x) - x * Math.exp(-x)) / x;
}

function curveOf(stages: Stage[]): Curve {
  let shift = 0;
  let total = 0;
  const means: number[] = [];
  for (const s of stages) {
    if ("fixedMs" in s) shift += Math.max(0, s.fixedMs);
    else if (s.meanMs > 0) {
      means.push(s.meanMs);
      total += s.meanMs;
    }
  }
  if (means.length === 0) return { shift, dt: 0, cdf: new Float64Array([1]) };
  const dt = (total * REACH) / POINTS;
  // Start with everything finished at time zero, then add one exponential part at a time. Adding an
  // exponential with rate λ to a time with distribution F gives G(t) = ∫ F(t − u) λ e^{−λu} du, and on a grid
  // G(t + dt) = e^{−λ·dt} G(t) + (the part of F inside the last step), exact when F is linear within a step.
  let cdf = new Float64Array(POINTS + 1).fill(1);
  for (const mean of means) {
    const x = dt / mean;
    const keep = Math.exp(-x);
    const ramp = rampWeight(x);
    const next = new Float64Array(POINTS + 1);
    for (let i = 0; i < POINTS; i++) {
      const a = cdf[i] as number;
      const b = cdf[i + 1] as number;
      next[i + 1] = keep * (next[i] as number) + b * (1 - keep) - (b - a) * ramp;
    }
    cdf = next;
  }
  return { shift, dt, cdf };
}

/** Probability the trip is still going at time `t`. */
function survival(curve: Curve, t: number): number {
  const u = t - curve.shift;
  if (u < 0) return 1;
  if (curve.dt === 0) return 0;
  const x = u / curve.dt;
  const i = Math.floor(x);
  if (i >= POINTS) return Math.max(0, 1 - (curve.cdf[POINTS] as number));
  const a = curve.cdf[i] as number;
  const b = curve.cdf[i + 1] as number;
  return Math.min(1, Math.max(0, 1 - (a + (b - a) * (x - i))));
}

/** The end of a branch's grid: past it, nothing is left. */
function horizon(curve: Curve): number {
  return curve.shift + curve.dt * POINTS;
}

/** Mean of a mixture of branches, in milliseconds. */
export function meanOf(branches: Branch[]): number {
  const weight = branches.reduce((sum, b) => sum + Math.max(0, b.weight), 0);
  if (weight <= 0) return 0;
  return (
    branches.reduce(
      (sum, b) =>
        sum + Math.max(0, b.weight) * b.stages.reduce((s, st) => s + ("fixedMs" in st ? st.fixedMs : st.meanMs), 0),
      0,
    ) / weight
  );
}

/**
 * The time by which a share `q` of requests have finished (q = 0.99 is the p99), in milliseconds. Branch
 * weights need not add up to one: they are taken relative to each other.
 */
export function percentileOf(branches: Branch[], q = 0.99): number {
  const live = branches.filter((b) => b.weight > 0);
  const weight = live.reduce((sum, b) => sum + b.weight, 0);
  if (weight <= 0) return 0;
  const curves = live.map((b) => ({ share: b.weight / weight, curve: curveOf(b.stages) }));
  const tail = 1 - Math.min(Math.max(q, 0), 1);
  const beyond = (t: number) => curves.reduce((sum, c) => sum + c.share * survival(c.curve, t), 0);
  let lo = 0;
  let hi = Math.max(...curves.map((c) => horizon(c.curve)));
  if (beyond(lo) <= tail) return 0;
  // The mixture's survival only falls as t grows, so halve the interval until it is a hair wide.
  for (let i = 0; i < 64 && hi - lo > 1e-9 * Math.max(1, hi); i++) {
    const mid = (lo + hi) / 2;
    if (beyond(mid) > tail) lo = mid;
    else hi = mid;
  }
  return hi;
}
