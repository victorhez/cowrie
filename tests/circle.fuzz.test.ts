import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { randomRun } from "./harness";

describe("property tests: invariants I1 to I11 over random circles", () => {
  it("holds across 5,000 random circles", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 2_000_000_000 }), (seed) => {
        const { violations } = randomRun(seed, { maxMembers: 12 });
        expect(violations).toEqual([]);
      }),
      { numRuns: 5000 },
    );
  });

  it("holds for the maximum group size (24)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 2_000_000_000 }), (seed) => {
        const { violations } = randomRun(seed, { maxMembers: 24 });
        expect(violations).toEqual([]);
      }),
      { numRuns: 500 },
    );
  });
});
