import { useId, useMemo, useState } from "react";

import type { Metric } from "@/components/admin/metrics";
import { cn } from "@/lib/cn";
import type { TimeSeriesPoint } from "@/types/api";

/**
 * The dashboard's activity chart.
 *
 * **Written by hand rather than pulled from a chart library.** Recharts is ~110 kB gzipped and
 * brings its own React tree, its own theming model and its own opinions about typography — to draw
 * one line. Everything below is an SVG path, a gradient and some arithmetic, it inherits the design
 * tokens for free, and it is the difference between a dashboard that looks like this application
 * and one that looks like a chart library.
 *
 * **Two axes, because money and counts are not the same quantity.** Revenue is in rupees; orders,
 * customers and products are counts. On one scale, ₹1,698 next to 3 customers draws the customers
 * flat along the floor and says nothing. So the rupee scale is labelled down the left, the count
 * scale down the right, and every series declares which one it belongs to.
 *
 * **Axis labels are HTML, not `<text>`.** The SVG has a fixed viewBox and scales to its container,
 * which scales everything inside it — an 11px label became 23px on a wide screen. Positioning the
 * labels outside the SVG keeps them at a real CSS size at every width.
 */

// A fixed viewBox: the box is fixed and the SVG scales as a block, so the stroke stays even.
const W = 720;
const H = 200;
const PAD = { top: 10, right: 4, bottom: 8, left: 4 };
const GRID = [0, 0.25, 0.5, 0.75, 1];

/**
 * Catmull-Rom through the points, converted to cubic béziers.
 *
 * Why not `L` between points: thirty daily readings as a polyline reads as noise. Why not a plain
 * quadratic smoothing: it does not pass through the data points, so the curve stops being the
 * data. Catmull-Rom interpolates — every point is on the line — while still being smooth, which is
 * the only kind of smoothing a chart is allowed to do.
 *
 * The 1/6 coefficient is a 0.5 tension, deliberately: at 1.0 the curve overshoots a sharp spike
 * and invents values that never happened, including negative revenue.
 */
function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0]!.x} ${points[0]!.y}`;

  let d = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[i + 2] ?? p2;

    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

/** A round number at or above `value`, so the axis reads 400 rather than 387. */
function niceCeiling(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalised = value / magnitude;
  const step = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10;
  return step * magnitude;
}

function formatDay(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function ActivityChart({
  points,
  metrics,
  className,
}: {
  points: TimeSeriesPoint[];
  /** One metric, or all four. The axes adapt to whichever are present. */
  metrics: Metric[];
  className?: string;
}) {
  const gradientId = useId();
  const [hover, setHover] = useState<number | null>(null);

  const chart = useMemo(() => {
    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;
    const step = points.length > 1 ? innerW / (points.length - 1) : 0;

    // One ceiling per axis, shared by every series measured against it — that sharing is the
    // whole point of an axis. Both are anchored at zero: a count axis that started at its minimum
    // would draw "products went from 11 to 14" as a vertical cliff.
    const ceilingFor = (axis: Metric["axis"]) => {
      const peak = Math.max(
        0,
        ...metrics.filter((m) => m.axis === axis).flatMap((m) => points.map(m.value)),
      );
      return niceCeiling(peak);
    };

    const ceilings = { money: ceilingFor("money"), count: ceilingFor("count") };

    const series = metrics.map((metric) => {
      const ceiling = ceilings[metric.axis] || 1;
      return {
        metric,
        coords: points.map((point, index) => ({
          x: PAD.left + index * step,
          y: PAD.top + innerH - (metric.value(point) / ceiling) * innerH,
        })),
      };
    });

    return { series, ceilings, step, baseline: PAD.top + innerH };
  }, [points, metrics]);

  // An axis is only labelled when a series actually uses it — a rupee scale beside a chart with
  // no money on it is furniture pretending to be information.
  const axesInUse = new Set(metrics.map((m) => m.axis));
  const soleSeries = chart.series.length === 1 ? chart.series[0] : null;
  const active = hover === null ? null : points[hover];
  const hoverX = hover === null ? null : (PAD.left + hover * chart.step) / W;

  const ticks = points.length <= 1 ? [0] : [0, Math.floor((points.length - 1) / 2), points.length - 1];

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex gap-2">
        <AxisLabels
          side="left"
          ceiling={chart.ceilings.money}
          format={metrics.find((m) => m.axis === "money")?.format}
          show={axesInUse.has("money")}
        />

        <div className="relative min-w-0 flex-1">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="block w-full"
            role="img"
            aria-label={`${metrics.map((m) => m.label).join(", ")} over the last ${points.length} days`}
            onPointerLeave={() => setHover(null)}
            onPointerMove={(event) => {
              const box = event.currentTarget.getBoundingClientRect();
              // Pointer position is in CSS pixels; the paths are in viewBox units.
              const x = ((event.clientX - box.left) / box.width) * W - PAD.left;
              const index = chart.step === 0 ? 0 : Math.round(x / chart.step);
              setHover(Math.min(points.length - 1, Math.max(0, index)));
            }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={soleSeries?.metric.color ?? "var(--accent)"}
                  stopOpacity="0.2"
                />
                <stop
                  offset="100%"
                  stopColor={soleSeries?.metric.color ?? "var(--accent)"}
                  stopOpacity="0"
                />
              </linearGradient>
            </defs>

            {GRID.map((fraction) => {
              const y = PAD.top + (H - PAD.top - PAD.bottom) * fraction;
              return (
                <line
                  key={fraction}
                  x1={PAD.left}
                  x2={W - PAD.right}
                  y1={y}
                  y2={y}
                  stroke="var(--line)"
                  strokeWidth={1}
                  strokeDasharray={fraction === 1 ? undefined : "3 6"}
                />
              );
            })}

            {/* The area fill is only drawn for a single series. Four translucent
                fills stacked on each other is mud, and it hides the lines it is
                supposed to support. */}
            {soleSeries ? (
              <path
                d={`${smoothPath(soleSeries.coords)} L ${soleSeries.coords.at(-1)?.x ?? 0} ${chart.baseline} L ${soleSeries.coords[0]?.x ?? 0} ${chart.baseline} Z`}
                fill={`url(#${gradientId})`}
              />
            ) : null}

            {hoverX !== null ? (
              <line
                x1={hoverX * W}
                x2={hoverX * W}
                y1={PAD.top}
                y2={chart.baseline}
                stroke="var(--line-strong)"
                strokeWidth={1}
              />
            ) : null}

            {chart.series.map(({ metric, coords }) => (
              <path
                // Keyed on the whole selection so switching filters restarts the
                // draw-on animation — a redraw, rather than a silent swap the
                // eye can miss.
                key={`${metric.key}-${metrics.length}`}
                d={smoothPath(coords)}
                fill="none"
                stroke={metric.color}
                // Thin, so four lines crossing each other stay legible.
                strokeWidth={soleSeries ? 2 : 1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="[stroke-dasharray:2400] [stroke-dashoffset:2400] animate-[draw-line_var(--dur-chart)_var(--ease-out)_forwards]"
              />
            ))}

            {hover !== null
              ? chart.series.map(({ metric, coords }) => {
                  const point = coords[hover];
                  if (!point) return null;
                  return (
                    <circle
                      key={metric.key}
                      cx={point.x}
                      cy={point.y}
                      r={4}
                      fill="var(--surface)"
                      stroke={metric.color}
                      strokeWidth={2.5}
                    />
                  );
                })
              : null}
          </svg>

          {active ? (
            <div
              className={cn(
                "pointer-events-none absolute top-1 z-10 -translate-x-1/2",
                "rounded-md border border-line bg-surface px-2 py-1.5 shadow-overlay",
                "animate-[fade-in_var(--dur-fast)_var(--ease-out)]",
              )}
              // Clamped so the tooltip cannot hang off either edge of the card.
              style={{ left: `${Math.min(88, Math.max(12, (hoverX ?? 0) * 100))}%` }}
            >
              <p className="whitespace-nowrap text-2xs text-ink-subtle">{formatDay(active.date)}</p>
              {metrics.map((metric) => (
                <p key={metric.key} className="flex items-center gap-1.5 whitespace-nowrap">
                  <span
                    className="size-1.5 shrink-0 rounded-full"
                    style={{ background: metric.color }}
                    aria-hidden
                  />
                  <span className="text-2xs text-ink-muted">{metric.label}</span>
                  <span className="ml-auto text-2xs font-semibold tabular-nums text-ink">
                    {metric.format(metric.value(active))}
                  </span>
                </p>
              ))}
            </div>
          ) : null}
        </div>

        <AxisLabels
          side="right"
          ceiling={chart.ceilings.count}
          format={String}
          show={axesInUse.has("count")}
        />
      </div>

      {/* Dates in HTML rather than inside the SVG, so they stay 11px at any width. */}
      <div className="relative h-4 text-2xs text-ink-subtle">
        {ticks.map((index) => {
          const point = points[index];
          if (!point) return null;
          const at = index / Math.max(1, points.length - 1);
          return (
            <span
              key={index}
              className="absolute whitespace-nowrap tabular-nums"
              style={{
                left: `${at * 100}%`,
                transform: at === 0 ? "none" : at === 1 ? "translateX(-100%)" : "translateX(-50%)",
              }}
            >
              {formatDay(point.date)}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/**
 * One axis's tick labels, in HTML alongside the plot.
 *
 * Rendered even when hidden (as an empty column of the same width) so that switching between one
 * series and all four does not shift the plot sideways.
 */
function AxisLabels({
  side,
  ceiling,
  format,
  show,
}: {
  side: "left" | "right";
  ceiling: number;
  format: ((value: number) => string) | undefined;
  show: boolean;
}) {
  const render = format ?? String;

  return (
    <div
      className={cn(
        "flex w-14 shrink-0 flex-col justify-between py-px text-2xs tabular-nums text-ink-subtle",
        side === "left" ? "items-end" : "items-start",
      )}
      aria-hidden
    >
      {show
        ? [...GRID].reverse().map((fraction) => <span key={fraction}>{render(ceiling * fraction)}</span>)
        : null}
    </div>
  );
}
