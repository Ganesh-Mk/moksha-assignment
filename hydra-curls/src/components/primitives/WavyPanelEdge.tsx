import { cn } from '@/lib/utils'

interface WavyPanelEdgeProps {
  /** Which side of the panel the edge sits on — the side facing the photograph. */
  side: 'left' | 'right'
  /** Tailwind fill utility, matching the panel's own background. */
  fillClassName: string
  className?: string
}

/**
 * The wavy seam between a Learn & Grow photograph and its colour panel.
 *
 * The design does not butt these two together on a straight line: the panel's leading edge
 * ripples down the join and laps over the photograph. Reproduced as one stretched path rather
 * than a border, so the ripple keeps its amplitude while the row's height changes with the copy.
 *
 * `preserveAspectRatio="none"` is what makes that work — the 40x800 box distorts to whatever the
 * row ends up being, and the wave stays the same width.
 */
export function WavyPanelEdge({ side, fillClassName, className }: WavyPanelEdgeProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 40 800"
      preserveAspectRatio="none"
      className={cn(
        'pointer-events-none absolute inset-y-0 hidden w-10 lg:block',
        side === 'left' ? 'right-full' : 'left-full -scale-x-100',
        className,
      )}
    >
      <path
        d="M40 0H16c14 66-12 100 2 166s-14 100 0 166-12 100 2 166-14 100 0 136 8 40 4 66h16z"
        className={fillClassName}
      />
    </svg>
  )
}
