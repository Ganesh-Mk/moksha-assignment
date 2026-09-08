import { cn } from '@/lib/utils'

interface CurvedTextProps {
  /**
   * Unique id for the SVG path this text follows. Passed in rather than generated with
   * `useId` because only some of the page hydrates, and React's generated ids depend on a
   * component's position within its root — an element rendered on the server under one root
   * and hydrated under another would disagree about its own id.
   */
  id: string
  children: string
  className?: string
  /** Arc width in SVG user units. Use the Figma span so `sag` and `fontSize` stay comparable. */
  chord?: number
  /**
   * How far the middle of the baseline drops below its ends, in the same units. Positive bows
   * the text downward (a smile); negative bows it upward.
   */
  sag?: number
  /** Glyph size in the same user units — the Figma value, e.g. 72 for the Kaushan arc. */
  fontSize?: number
  fontClassName?: string
}

/**
 * Text set on a curved baseline.
 *
 * Figma stores both curved passages as one node per glyph, each separately positioned and
 * rotated — 48 Kaushan Script nodes for "Experience the power of hydration in every drop." and
 * 144 Inter nodes for the repeating "Hydra Curls" arc. Reproducing that as ~192 absolutely
 * positioned spans would be unreadable, unselectable, invisible to search engines, and would
 * shatter the moment the type scale changed.
 *
 * An SVG <textPath> is the right primitive: one real string, still selectable and announced
 * normally, crisp at any size, and it rescales with the viewBox for free.
 *
 * The API takes the two numbers actually measurable from the node tree — the horizontal span
 * of the glyph run and how far its middle sags — and derives the circle from them, rather than
 * asking the caller to reason about a radius.
 *
 * Deliberately no `role="img"` + `aria-label`: the <text> content is already exposed to the
 * accessibility tree, so labelling the wrapper would announce the same sentence twice.
 */
export function CurvedText({
  id,
  children,
  className,
  chord = 1572,
  sag = 251,
  fontSize = 72,
  fontClassName = 'font-script',
}: CurvedTextProps) {
  const pathId = `curve-${id}`

  // Radius of the circle through both ends and the midpoint, from the sagitta:
  // R = c² / 8s + s / 2. Guard against a zero sag, which would be a straight line.
  const s = Math.abs(sag) || 1
  const radius = (chord * chord) / (8 * s) + s / 2
  // SVG's y axis points down, so a sweep of 1 from the left end to the right end travels
  // *over the top* — a hill. A sag that drops the middle below its ends is therefore sweep 0.
  // This was inverted, which is why the script arc bowed the opposite way to the design.
  const sweep = sag >= 0 ? 0 : 1

  // Room for ascenders above the baseline and descenders below it, so glyphs are not clipped.
  const ascent = fontSize
  const descent = fontSize * 0.45
  const height = ascent + s + descent

  // A sag deeper than half the chord is a *major* arc — the long way round the circle. Without
  // the large-arc flag the path silently falls back to the shallow minor arc, which is why the
  // near-circular watermark arcs came out almost flat.
  const largeArc = s > chord / 2 ? 1 : 0

  const d = `M 0,${ascent} A ${radius},${radius} 0 ${largeArc},${sweep} ${chord},${ascent}`

  return (
    <svg
      viewBox={`0 0 ${chord} ${height}`}
      className={cn('w-full overflow-visible', className)}
      focusable="false"
    >
      <defs>
        <path id={pathId} d={d} fill="none" />
      </defs>
      <text className={cn(fontClassName, 'fill-current')} fontSize={fontSize}>
        <textPath href={`#${pathId}`} startOffset="50%" textAnchor="middle">
          {children}
        </textPath>
      </text>
    </svg>
  )
}
