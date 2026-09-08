import { useId, useMemo, useState } from "react";

import type { Metric } from "@/components/admin/metrics";
import { cn } from "@/lib/cn";
import type { TimeSeriesPoint } from "@/types/api";

/**
 * The dashboard's activity chart.
 *
 * **Written by hand rather than pulled from a chart library.** Recharts is
 * ~110 kB gzipped and brings its own React tree, its own theming model and its
 * own opinions about typography — to draw one line. Everything below is an SVG
 * path, a gradient and about a hundred lines of arithmetic, it inherits the
 * design tokens for free, and it is the difference between a dashboard that
 * looks like this application and one that looks like a chart library.
 *
 * **One series at a time, chosen with the filter.** The four numbers are not
 * commensurable: revenue and orders are *flows* (what happened that day),
 * customers and products are *stocks* (how many existed by the end of it).
 * Overlaying a daily count and a running total on one y-axis draws a picture
 * that is simply untrue — the running total only ever goes up, so it always
 * looks like the winner. Switching between them is honest and, on a dashboard,
 * is what an operator does anyway.
 */

// A fixed viewBox with preserveAspectRatio="none" would stretch the stroke.
// Instead the box is fixed and the SVG scales as a block — the line stays even.
const W = 720;
const H = 220;
const PAD = { top: 16, right: 8, bottom: 26, left: 8 };

/**
 * Catmull-Rom through the points, converted to cubic béziers.
 *
 * Why not just `L` between points: a polyline of thirty daily readings reads as
 * noise. Why not a plain quadratic smoothing: it does not pass through the data
 * points, so the curve stops being the data. Catmull-Rom interpolates — every
 * point is on the line — while still being smooth, which is the only kind of
 * smoothing a chart is allowed to do.
 *
 * The 0.5 tension is deliberate: at 1.0 the curve overshoots on a sharp spike
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
  metric,
  className,
}: {
  points: TimeSeriesPoint[];
  metric: Metric;
  className?: string;
}) {
  const gradientId = useId();
  const [hover, setHover] = useState<number | null>(null);

  const geometry = useMemo(() => {
    const values = points.map(metric.value);
    // A flow series is anchored at zero — starting the axis at the minimum
    // exaggerates a small wobble into a cliff. A stock series is not, because a
    // customer count of 1,000 → 1,010 flattened against zero shows nothing.
    const floor = metric.kind === "flow" ? 0 : Math.min(...values, 0);
    const ceiling = niceCeiling(Math.max(...values, floor + 1));
    const span = ceiling - floor || 1;

    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;
    const step = points.length > 1 ? innerW / (points.length - 1) : 0;

    const coords = points.map((point, index) => ({
      x: PAD.left + index * step,
      y: PAD.top + innerH - ((metric.value(point) - floor) / span) * innerH,
    }));

    return { coords, ceiling, floor, step, baseline: PAD.top + innerH };
  }, [points, metric]);

  const line = smoothPath(geometry.coords);
  const area =
    geometry.coords.length > 0
      ? `${line} L ${geometry.coords.at(-1)!.x} ${geometry.baseline} L ${geometry.coords[0]!.x} ${geometry.baseline} Z`
      : "";

  const active = hover === null ? null : points[hover];
  const activeCoord = hover === null ? null : geometry.coords[hover];

  // Enough ticks to orient, few enough to read. Always includes both ends.
  const tickIndices = points.length <= 1 ? [0] : [0, Math.floor((points.length - 1) / 2), points.length - 1];

  return (
    <div className={cn("relative", className)}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block w-full"
        role="img"
        aria-label={`${metric.label} over the last ${points.length} days`}
        onPointerLeave={() => setHover(null)}
        onPointerMove={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          // Pointer position is in CSS pixels; the path is in viewBox units.
          const x = ((event.clientX - box.left) / box.width) * W - PAD.left;
          const index = geometry.step === 0 ? 0 : Math.round(x / geometry.step);
          setHover(Math.min(points.length - 1, Math.max(0, index)));
        }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Gridlines behind everything, at quarter heights. Faint enough to
            read a value against and quiet enough to ignore. */}
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
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
              strokeDasharray={fraction === 1 ? undefined : "3 5"}
            />
          );
        })}

        <path d={area} fill={`url(#${gradientId})`} />

        {/* `key` on the metric restarts the draw-on animation whenever the
            series changes, so switching filters is a redraw rather than a
            silent swap the eye can miss. */}
        <path
          key={metric.key}
          d={line}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="[stroke-dasharray:2000] [stroke-dashoffset:2000] animate-[draw-line_var(--dur-chart)_var(--ease-out)_forwards]"
        />

        {activeCoord ? (
          <>
            <line
              x1={activeCoord.x}
              x2={activeCoord.x}
              y1={PAD.top}
              y2={geometry.baseline}
              stroke="var(--line-strong)"
              strokeWidth={1}
            />
            <circle
              cx={activeCoord.x}
              cy={activeCoord.y}
              r={5}
              fill="var(--surface)"
              stroke="var(--accent)"
              strokeWidth={2.5}
            />
          </>
        ) : null}

        {tickIndices.map((index) => {
          const point = points[index];
          const coord = geometry.coords[index];
          if (!point || !coord) return null;
          return (
            <text
              key={index}
              x={coord.x}
              y={H - 8}
              textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"}
              className="fill-[var(--ink-subtle)] text-[11px]"
            >
              {formatDay(point.date)}
            </text>
          );
        })}
      </svg>

      {/* The peak value, so the chart is readable without hovering — which
          matters because touch has no hover at all. */}
      <span className="pointer-events-none absolute left-0 top-0 text-2xs tabular-nums text-ink-subtle">
        {metric.format(geometry.ceiling)}
      </span>

      {active ? (
        <div
          className={cn(
            "pointer-events-none absolute -translate-x-1/2 -translate-y-full",
            "rounded-md border border-line bg-surface px-2 py-1.5 shadow-overlay",
            "animate-[fade-in_var(--dur-fast)_var(--ease-out)]",
          )}
          style={{
            // Clamped so the tooltip cannot hang off either edge of the card.
            left: `${Math.min(92, Math.max(8, ((activeCoord?.x ?? 0) / W) * 100))}%`,
            top: `${((activeCoord?.y ?? 0) / H) * 100 - 4}%`,
          }}
        >
          <p className="text-2xs text-ink-subtle">{formatDay(active.date)}</p>
          <p className="tnum text-sm font-semibold text-ink">
            {metric.format(metric.value(active))}
          </p>
        </div>
      ) : null}
    </div>
  );
}
