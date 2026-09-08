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
      viewBox="0 0 120 800"
      preserveAspectRatio="none"
      className={cn(
        // The path now runs the full 800 of its own box. It used to stop at 700, which left the
        // bottom eighth of every seam unpainted — the sliver that appeared to escape the row.
        'pointer-events-none absolute inset-y-0 hidden w-[clamp(2.5rem,5vw,7.5rem)] lg:block',
        // Pulled back half its own width so the ripple is centred on the join. Sitting
        // wholly outside the panel put it left of the seam on one row and right of it on the
        // next, which is what made consecutive rows look 40px out of step.
        side === 'left'
          ? 'right-full -mr-[clamp(1.25rem,2.5vw,3.75rem)]'
          : 'left-full -ml-[clamp(1.25rem,2.5vw,3.75rem)] -scale-x-100',
        className,
      )}
    >
      <path
        d="M120 0H54C96 84 10 168 46 250S6 414 52 496 4 656 44 738 88 776 60 800h60z"
        className={fillClassName}
      />
    </svg>
  )
}
