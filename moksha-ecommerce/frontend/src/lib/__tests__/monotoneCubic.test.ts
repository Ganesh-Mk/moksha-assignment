import { describe, expect, it } from "vitest";

import { monotoneCubicPath, sampleMonotoneCubic, type Point } from "@/lib/monotoneCubic";

/** A series of y values on an evenly spaced x axis, which is what a daily chart always is. */
const series = (ys: number[]): Point[] => ys.map((y, index) => ({ x: index * 10, y }));

const range = (values: number[]) => ({ min: Math.min(...values), max: Math.max(...values) });

describe("monotoneCubicPath", () => {
  it("passes through every reading", () => {
    // Interpolation, not approximation. A curve that only goes *near* the data is not the data.
    const points = series([5, 30, 12, 40]);
    const path = monotoneCubicPath(points);

    for (const point of points) {
      expect(path).toContain(`${point.x.toFixed(2)} ${point.y.toFixed(2)}`);
    }
  });

  it("degrades to a straight line for two points, and a move for one", () => {
    expect(monotoneCubicPath(series([4, 9]))).toBe("M 0 4 L 10 9");
    expect(monotoneCubicPath(series([4]))).toBe("M 0 4");
    expect(monotoneCubicPath([])).toBe("");
  });
});

describe("the curve never leaves the range of its data", () => {
  // The bug this file exists for. Catmull-Rom drew twenty-nine days of zero customers followed by
  // two as a dip below the axis and then an overshoot above the peak — a fortnight of negative
  // customers, rendered confidently.
  it.each([
    ["a late step", [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2]],
    ["an early step", [3, 3, 3, 0, 0, 0, 0, 0, 0]],
    ["a lone spike", [0, 0, 0, 0, 100, 0, 0, 0, 0]],
    ["a staircase", [0, 0, 1, 1, 1, 2, 2, 5, 5]],
    ["flat", [7, 7, 7, 7, 7]],
    ["a sawtooth", [0, 9, 0, 9, 0, 9]],
    ["real revenue", [0, 0, 0, 0, 0, 0, 0, 0, 0, 129900, 39900]],
  ])("holds for %s", (_label, values) => {
    const { min, max } = range(values);
    const sampled = sampleMonotoneCubic(series(values));

    // A hair of tolerance for floating point, not for overshoot: the failures this catches were
    // tens of percent outside the range, not fractions of one.
    expect(Math.min(...sampled)).toBeGreaterThanOrEqual(min - 1e-9);
    expect(Math.max(...sampled)).toBeLessThanOrEqual(max + 1e-9);
  });

  it("in particular, a count series never goes negative", () => {
    const sampled = sampleMonotoneCubic(series([0, 0, 0, 0, 0, 0, 0, 0, 2]));

    expect(Math.min(...sampled)).toBeGreaterThanOrEqual(0);
  });

  it("keeps a run of equal values perfectly flat", () => {
    // Not just "within range" — a smoothing that bulges through a flat run implies activity on
    // days when nothing happened.
    const sampled = sampleMonotoneCubic(series([0, 0, 0, 0, 5]));
    const acrossTheFlatRun = sampled.slice(0, 3 * 25);

    expect(Math.max(...acrossTheFlatRun)).toBe(0);
  });
});

describe("monotone segments stay monotone", () => {
  it("a rising series never dips", () => {
    // Cumulative series — customers, products — only ever go up. A curve that dips between two
    // rising readings shows a customer count falling, which cannot happen.
    const sampled = sampleMonotoneCubic(series([0, 1, 1, 4, 9, 9, 14]));

    for (let i = 1; i < sampled.length; i += 1) {
      expect(sampled[i]!).toBeGreaterThanOrEqual(sampled[i - 1]! - 1e-9);
    }
  });
});
