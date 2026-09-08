import { cn } from '@/lib/utils'

interface CircularTextProps {
  /** Unique id for the ring path. Explicit for the same reason CurvedText's is — see that file. */
  id: string
  children: string
  /** Glyph size in the 240-unit box the ring is drawn in. */
  fontSize?: number
  className?: string
  textClassName?: string
}

/**
 * Text set around a closed circle.
 *
 * `CurvedText` cannot express this: its API is a chord and a sag, which describes an arc, and a
 * full revolution has neither. The repeating "Hydra Curls" watermarks in the design are complete
 * rings, and approximating one with a very deep arc leaves a visible seam where the ends fail to
 * meet.
 *
 * Two arcs make the circle so the path is closed and the text runs continuously; it starts at the
 * top and reads clockwise.
 */
export function CircularText({
  id,
  children,
  fontSize = 17,
  className,
  textClassName,
}: CircularTextProps) {
  const pathId = `ring-${id}`

  return (
    <svg
      viewBox="0 0 240 240"
      className={cn('block', className)}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <path id={pathId} d="M120 22a98 98 0 1 1 0 196 98 98 0 1 1 0-196" fill="none" />
      </defs>
      <text className={cn('font-curved fill-current', textClassName)} fontSize={fontSize}>
        <textPath href={`#${pathId}`} startOffset="50%" textAnchor="middle">
          {children}
        </textPath>
      </text>
    </svg>
  )
}
