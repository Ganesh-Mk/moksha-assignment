import { cn } from '@/lib/utils'

/**
 * The 48-hour clock beside the hydration stat.
 *
 * Figma exports this as two flat rasters — a thin dark ring with a centre dot, and a cyan clock
 * whose hands are baked into the pixels. A picture of a clock is a slightly odd thing to put
 * next to a claim about time passing, and there is nothing in a PNG to animate.
 *
 * Redrawn as SVG so the hands can actually move: the long hand sweeps a full turn every four
 * seconds and the short one takes forty-eight, so the pair reads as forty-eight hours elapsing
 * rather than as a frozen clock face. Both are pure `rotate` on the compositor, and the whole
 * thing holds still under `prefers-reduced-motion` — the drawing is complete standing still, so
 * nothing is lost.
 *
 * Drawn at the exported 150x150 so the geometry stays comparable with the assets it replaces.
 */
export function HydrationClock({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 150 150"
      className={cn('block', className)}
      // Decorative: the figure beside it is already a description list announcing "48 Hours",
      // so labelling the drawing too would say it twice.
      aria-hidden="true"
      focusable="false"
    >
      {/* The open progress ring, matching the exported `icon-arc`: a gap at the upper left and
          a dot at the centre. It turns once a minute, slowly enough to read as deliberate. */}
      <g className="clock-ring origin-center">
        <path
          d="M13 52.4A66 66 0 1 1 52.4 137"
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          className="stroke-brand-cyan-deepest"
        />
      </g>

      {/* The face. */}
      <circle cx="75" cy="75" r="50" fill="none" strokeWidth="14" className="stroke-brand-cyan" />
      <circle cx="75" cy="75" r="43" fill="white" />

      {/* Hands. Both start pointing at twelve, which is where the exported artwork has them. */}
      <g strokeLinecap="round" className="stroke-brand-cyan-ink">
        <line
          x1="75"
          y1="75"
          x2="75"
          y2="43"
          strokeWidth="3"
          className="clock-minute origin-center"
        />
        <line
          x1="75"
          y1="75"
          x2="75"
          y2="52"
          strokeWidth="4"
          className="clock-hour origin-center"
        />
      </g>

      <circle cx="75" cy="75" r="4" className="fill-brand-cyan-deepest" />
    </svg>
  )
}
