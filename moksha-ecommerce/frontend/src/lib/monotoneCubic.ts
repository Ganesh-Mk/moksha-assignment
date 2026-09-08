/**
 * A monotone cubic interpolation (Fritsch–Carlson), as an SVG path.
 *
 * **This started as Catmull-Rom and that was wrong.** Catmull-Rom is smooth and it interpolates —
 * every reading is on the line — but it does not preserve monotonicity. On a step, which is what a
 * new shop's data mostly is (twenty-nine days of zero customers, then two), it overshoots the rise
 * and dips *below* zero on the approach, drawing a fortnight of negative customers that never
 * existed. A curve that invents values is not a styling problem; it is a false statement about the
 * data, which is the one thing a chart may not do.
 *
 * Fritsch–Carlson cannot do that, by construction. It takes a tangent at each point and then
 * *limits* those tangents so every segment stays monotone between its two endpoints — which means
 * the curve is bounded by the pair of readings it connects. Flat stays flat, a step stays a step,
 * and the line still passes through every point.
 *
 * Same algorithm as d3's `curveMonotoneX`, in about twenty lines. It lives here rather than in the
 * chart component so the property above can be tested as the pure function it is: sample the curve
 * densely, assert nothing leaves the range of the input.
 */

export interface Point {
  x: number;
  y: number;
}

export function monotoneCubicPath(points: Point[]): string {
  const n = points.length;
  if (n === 0) return "";
  if (n === 1) return `M ${points[0]!.x} ${points[0]!.y}`;
  if (n === 2) return `M ${points[0]!.x} ${points[0]!.y} L ${points[1]!.x} ${points[1]!.y}`;

  const tangents = monotoneTangents(points);

  // Cubic Hermite written as a bezier: each control point sits one third of the way along the
  // segment, on the tangent line through its endpoint.
  let d = `M ${points[0]!.x.toFixed(2)} ${points[0]!.y.toFixed(2)}`;
  for (let i = 0; i < n - 1; i += 1) {
    const p0 = points[i]!;
    const p1 = points[i + 1]!;
    const third = (p1.x - p0.x) / 3;
    const c1y = p0.y + tangents[i]! * third;
    const c2y = p1.y - tangents[i + 1]! * third;
    d += ` C ${(p0.x + third).toFixed(2)} ${c1y.toFixed(2)}, ${(p1.x - third).toFixed(2)} ${c2y.toFixed(2)}, ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
  }
  return d;
}

/** Exported for the test, which asserts the limiting actually happens. */
export function monotoneTangents(points: Point[]): number[] {
  const n = points.length;

  const secants: number[] = [];
  for (let i = 0; i < n - 1; i += 1) {
    const dx = points[i + 1]!.x - points[i]!.x;
    secants.push(dx === 0 ? 0 : (points[i + 1]!.y - points[i]!.y) / dx);
  }

  // Initial guess: the average of the two neighbouring secants; the ends take theirs unaveraged.
  //
  // Except at a turning point. Where the two secants have opposite signs the point is a local
  // maximum or minimum, and any non-zero tangent there sends the curve past it — which is exactly
  // how a peak of ₹1,299 followed by a fall came out as ₹1,303. A flat tangent pins the extremum
  // to the reading. The radius-3 limiter below does not catch this on its own: at a peak the
  // averaged tangent can be small enough to stay inside the circle and still overshoot.
  const tangents: number[] = [secants[0]!];
  for (let i = 1; i < n - 1; i += 1) {
    const before = secants[i - 1]!;
    const after = secants[i]!;
    tangents.push(before * after <= 0 ? 0 : (before + after) / 2);
  }
  tangents.push(secants[n - 2]!);

  // The limiting step, which is what makes overshoot impossible. A flat segment forces both of its
  // tangents to zero — otherwise a curve would bulge through a run of equal values. Elsewhere the
  // pair is scaled back inside the circle of radius 3, the Fritsch–Carlson condition for the
  // segment to stay monotone.
  for (let i = 0; i < n - 1; i += 1) {
    if (secants[i] === 0) {
      tangents[i] = 0;
      tangents[i + 1] = 0;
      continue;
    }
    const a = tangents[i]! / secants[i]!;
    const b = tangents[i + 1]! / secants[i]!;
    const magnitude = a * a + b * b;
    if (magnitude > 9) {
      const scale = 3 / Math.sqrt(magnitude);
      tangents[i] = scale * a * secants[i]!;
      tangents[i + 1] = scale * b * secants[i]!;
    }
  }

  return tangents;
}

/**
 * Evaluate the curve at `samples` points per segment.
 *
 * Only the test uses this — the browser evaluates the bezier itself. It exists because "the curve
 * never leaves the range of its data" is a claim about every point on the curve, not just the ones
 * that were fed in, and the only honest way to check that is to look between them.
 */
export function sampleMonotoneCubic(points: Point[], samples = 24): number[] {
  if (points.length < 2) return points.map((p) => p.y);

  const tangents = monotoneTangents(points);
  const out: number[] = [];

  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i]!;
    const p1 = points[i + 1]!;
    const h = p1.x - p0.x;

    for (let s = 0; s <= samples; s += 1) {
      const t = s / samples;
      // Hermite basis functions.
      const h00 = 2 * t ** 3 - 3 * t ** 2 + 1;
      const h10 = t ** 3 - 2 * t ** 2 + t;
      const h01 = -2 * t ** 3 + 3 * t ** 2;
      const h11 = t ** 3 - t ** 2;
      out.push(h00 * p0.y + h10 * h * tangents[i]! + h01 * p1.y + h11 * h * tangents[i + 1]!);
    }
  }

  return out;
}
