import { cn } from '@/lib/utils'

interface WaveDividerProps {
  className?: string
  /** Fill for the region above the band — usually the colour of the section being left. */
  aboveClassName?: string
  /** Fill for the cyan band itself. */
  bandClassName?: string
  /** Mirrors the wave vertically, for the dividers that close a section rather than open it. */
  flip?: boolean
}

/**
 * The full-bleed cyan wave that separates the purple bands from the page.
 *
 * Two of these in the design (Figma `Rectangle 190` at y1122 and `Rectangle 140` at y4273),
 * both 1920 x 169 solid #00D5FD vector shapes.
 *
 * `preserveAspectRatio="none"` is deliberate: a divider should span the viewport at every
 * width and keep its height, so letting the curve stretch horizontally is correct here even
 * though it would be wrong for an icon.
 *
 * The band is drawn as two filled paths rather than a background image so it scales without
 * resampling, costs ~400 bytes, and recolours from theme tokens.
 */
export function WaveDivider({
  className,
  aboveClassName = 'fill-brand-purple',
  bandClassName = 'fill-brand-cyan',
  flip = false,
}: WaveDividerProps) {
  return (
    <svg
      viewBox="0 0 1920 169"
      preserveAspectRatio="none"
      // Purely a visual transition between two bands — it carries no information.
      aria-hidden="true"
      focusable="false"
      className={cn('block h-[clamp(3rem,7vw,10.5625rem)] w-full', flip && 'rotate-180', className)}
    >
      <path
        className={aboveClassName}
        d="M0 0 H1920 V26 C1600 10 1280 14 960 50 C640 86 320 78 0 42 Z"
      />
      <path
        className={bandClassName}
        d="M0 42 C320 78 640 86 960 50 C1280 14 1600 10 1920 26 V88 C1600 72 1280 76 960 112 C640 148 320 140 0 104 Z"
      />
    </svg>
  )
}
