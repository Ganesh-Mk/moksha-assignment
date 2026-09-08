import { cn } from '@/lib/utils'

interface SoftWaveProps {
  /**
   * Tailwind fill utility for the colour the wave carries — that is, the colour of the section
   * on the *other* side of the boundary. The wave paints that colour over this section's
   * background, so the seam becomes a curve instead of a straight edge.
   */
  fillClassName: string
  /** Mirrors the curve so adjacent boundaries do not repeat the same silhouette. */
  flip?: boolean
  className?: string
}

/**
 * The gentle curve that separates most of the page's colour bands.
 *
 * Distinct from `WaveDivider`, which is the design's bold cyan ribbon under the hero. This one
 * is the quiet version: several boundaries in the Figma render — the promise band into the
 * ingredients, the ingredients into the testimonials — are soft, low-amplitude curves rather
 * than the straight horizontal edges a plain background change produces. Reading those as
 * straight lines was a fidelity miss; each flat seam is a place the design has a curve.
 *
 * Drawn as one SVG path with `preserveAspectRatio="none"` so the curve stretches to any width
 * without the amplitude growing with it, and sits in the flow with a negative margin so it
 * overlaps the seam rather than adding height to the page.
 */
export function SoftWave({ fillClassName, flip = false, className }: SoftWaveProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 1440 120"
      preserveAspectRatio="none"
      className={cn(
        'pointer-events-none block h-[clamp(2.5rem,5vw,6rem)] w-full',
        flip && '-scale-x-100',
        className,
      )}
    >
      <path
        d="M0 62c180 46 360 22 540-2s360-44 540-10 300 46 360 38v32H0z"
        className={fillClassName}
      />
    </svg>
  )
}
