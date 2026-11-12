import { describe, expect, it } from "vitest";
import { meanOf, percentileOf } from "./tail-latency";

// Exact values are worked out from the closed forms, then checked to within 0.5%.
const near = (actual: number, expected: number, tolerance = 0.005) =>
  expect(Math.abs(actual - expected) / expected).toBeLessThan(tolerance);

describe("percentileOf", () => {
  it("gives ln(100) times the mean for one exponential part", () => {
    near(percentileOf([{ weight: 1, stages: [{ meanMs: 20 }] }]), 20 * Math.log(100));
  });

  it("matches the Erlang-2 tail for two equal parts in series", () => {
    // P(T > t) = (1 + λt)e^{−λt} = 0.01 at λt = 6.63835.
    near(percentileOf([{ weight: 1, stages: [{ meanMs: 5 }, { meanMs: 5 }] }]), 5 * 6.63835);
  });

  it("matches the closed form for two different parts in series", () => {
    // Means 10 and 40 ms: P(T > t) = (0.1e^{−t/40} − 0.025e^{−t/10}) / 0.075 = 0.01 at t = 195.71.
    near(percentileOf([{ weight: 1, stages: [{ meanMs: 10 }, { meanMs: 40 }] }]), 195.714);
  });

  it("puts the p99 on the slow branch when more than 1% of requests take it", () => {
    // 95% answered by a cache in about 1 ms, 5% going on to a 100 ms store: 0.95e^{−t} + 0.05e^{−t/100} = 0.01.
    const branches = [
      { weight: 0.95, stages: [{ meanMs: 1 }] },
      { weight: 0.05, stages: [{ meanMs: 1 }, { meanMs: 99 }] },
    ];
    const p99 = percentileOf(branches);
    expect(p99).toBeGreaterThan(100);
    // Same tail as a single 1 ms + 99 ms trip weighted 5%, to within the 1 ms part.
    expect(p99).toBeGreaterThan(155);
    expect(p99).toBeLessThan(170);
    near(percentileOf([{ weight: 0.95, stages: [{ meanMs: 1 }] }, { weight: 0.05, stages: [{ meanMs: 100 }] }]), 160.944);
  });

  it("keeps the p99 on the fast branch when fewer than 1% of requests are slow", () => {
    const p99 = percentileOf([
      { weight: 0.995, stages: [{ meanMs: 1 }] },
      { weight: 0.005, stages: [{ meanMs: 1 }, { meanMs: 99 }] },
    ]);
    expect(p99).toBeLessThan(10);
  });

  it("shifts by a fixed delay without spreading it", () => {
    near(percentileOf([{ weight: 1, stages: [{ fixedMs: 70 }, { meanMs: 10 }] }]), 70 + 10 * Math.log(100));
    expect(percentileOf([{ weight: 1, stages: [{ fixedMs: 70 }] }])).toBeCloseTo(70, 6);
  });

  it("is the same every time and rises with the slowest part", () => {
    const trip = (mean: number) => [{ weight: 1, stages: [{ meanMs: 15 }, { meanMs: mean }, { meanMs: 4 }] }];
    expect(percentileOf(trip(8))).toBe(percentileOf(trip(8)));
    let previous = 0;
    for (const mean of [4, 8, 16, 40, 80]) {
      const p99 = percentileOf(trip(mean));
      expect(p99).toBeGreaterThan(previous);
      expect(p99).toBeGreaterThan(meanOf(trip(mean)));
      previous = p99;
    }
  });

  it("weighs branches relative to each other and ignores empty ones", () => {
    const a = percentileOf([{ weight: 2, stages: [{ meanMs: 10 }] }, { weight: 0, stages: [{ meanMs: 1000 }] }]);
    near(a, 10 * Math.log(100));
    expect(percentileOf([])).toBe(0);
    expect(percentileOf([{ weight: 1, stages: [] }])).toBe(0);
  });
});

describe("meanOf", () => {
  it("weights each branch's total by its share", () => {
    expect(
      meanOf([
        { weight: 0.9, stages: [{ meanMs: 1 }] },
        { weight: 0.1, stages: [{ meanMs: 1 }, { meanMs: 50 }, { fixedMs: 9 }] },
      ]),
    ).toBeCloseTo(0.9 * 1 + 0.1 * 60, 9);
  });
});
