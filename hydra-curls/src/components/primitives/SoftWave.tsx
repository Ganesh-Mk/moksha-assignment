import { cn } from '@/lib/utils'

/**
 * The boundary silhouettes the design actually uses between its colour bands.
 *
 * Reading the reference render band by band, almost none of the seams are straight: the promise
 * hands over on a gentle wave, the testimonials on one long swoop, the hair-type band on a
 * diagonal, and the learn-and-grow heading on a row of shallow scallops. Rendering any of them
 * as a plain background change produces a hard horizontal line the design does not have.
 *
 * All four are drawn in the same 1440x120 box and closed to the bottom edge, so the shape paints
 * the *next* section's colour over this one and can be dropped at any boundary interchangeably.
 */
const SHAPES = {
  /** A generous single wave. The quiet default, but not a flat one. */
  soft: 'M0 58C260 122 500 8 740 34s460 78 700 26v62H0z',
  /** Deep scallops — the edge above the "Learn & Grow" heading. */
  bumpy: 'M0 76C120 12 250 16 372 56s238-58 356-24 232 78 356 38 236-62 356-24v76H0z',
  /**
   * One long asymmetric sweep. The band it covers ends high on the left and carries much further
   * down on the right, which is the way round the reference has it.
   */
  swoop: 'M0 4C480 40 960 84 1440 108v12H0z',
  /**
   * A straight diagonal rather than a curve. Unlike the others this one paints the wedge *above*
   * the line, which is how the hair-type band meets the cloud art above it.
   */
  diagonal: 'M0 0h1440v6L0 120z',
} as const

export type WaveShape = keyof typeof SHAPES

interface SoftWaveProps {
  /**
   * Tailwind fill utility for the colour the wave carries — the colour of the section on the
   * other side of the boundary, painted over this one.
   */
  fillClassName: string
  shape?: WaveShape
  /** Mirrors the silhouette so neighbouring boundaries do not repeat the same curve. */
  flip?: boolean
  className?: string
}

export function SoftWave({
  fillClassName,
  shape = 'soft',
  flip = false,
  className,
}: SoftWaveProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 1440 120"
      // Without this the curve's amplitude would grow with the viewport instead of stretching.
      preserveAspectRatio="none"
      className={cn(
        'pointer-events-none block h-[clamp(3rem,7vw,8.5rem)] w-full',
        flip && '-scale-x-100',
        className,
      )}
    >
      <path d={SHAPES[shape]} className={fillClassName} />
    </svg>
  )
}
