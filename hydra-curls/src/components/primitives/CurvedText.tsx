import { useId } from 'react'

import { cn } from '@/lib/utils'

interface CurvedTextProps {
  children: string
  className?: string
  /**
   * Arc geometry in the SVG's own coordinate space. `sweep` picks which side of the circle
   * the baseline follows: `1` bows the text downward (a smile), `0` upward.
   */
  radius?: number
  sweep?: 0 | 1
  /** Where along the path the text starts, as a percentage. 50% centres it. */
  offset?: string
  fontClassName?: string
}

/**
 * Text set on a curved baseline.
 *
 * Figma stores both curved passages as one node per glyph, each with its own rotation — 48
 * Kaushan Script nodes for "Experience the power of hydration in every drop." and 144 Inter
 * nodes for the repeating "Hydra Curls" arc. Reproducing that as ~192 absolutely positioned
 * spans would be unreadable, unselectable, invisible to search engines, and would shatter the
 * moment the type scale changed.
 *
 * An SVG <textPath> is the correct primitive instead: one real string of text, still
 * selectable and readable by assistive technology, crisp at any size, and it rescales with the
 * viewBox for free.
 *
 * Deliberately no `role="img"` + `aria-label`: the <text> content is already exposed to the
 * accessibility tree, so labelling the wrapper would announce the same sentence twice.
 */
export function CurvedText({
  children,
  className,
  radius = 400,
  sweep = 1,
  offset = '50%',
  fontClassName = 'font-script',
}: CurvedTextProps) {
  // The path is referenced by id, and this component renders more than once on the page.
  const pathId = useId()

  // A circular arc spanning the full width of the viewBox. The chord is fixed at 800 units so
  // callers reason about one number (radius) rather than a path expression.
  const d = `M 0,${radius} A ${radius},${radius} 0 0,${sweep} 800,${radius}`

  return (
    <svg
      viewBox={`0 0 800 ${radius * 2}`}
      className={cn('w-full overflow-visible', className)}
      focusable="false"
    >
      <defs>
        <path id={pathId} d={d} fill="none" />
      </defs>
      <text className={cn(fontClassName, 'fill-current')}>
        <textPath href={`#${pathId}`} startOffset={offset} textAnchor="middle">
          {children}
        </textPath>
      </text>
    </svg>
  )
}
