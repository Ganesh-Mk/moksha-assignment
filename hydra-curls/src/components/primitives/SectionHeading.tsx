import type { HeadingLine } from '@/content/sections'
import { cn } from '@/lib/utils'

interface SectionHeadingProps {
  /** Lines of runs. A run marked `accent` takes the highlight colour. */
  lines: readonly HeadingLine[]
  /** Needed so the owning <section> can point `aria-labelledby` at it. */
  id?: string
  className?: string
  /**
   * The highlight colour. Cyan everywhere except the testimonials band, where the heading
   * already sits on cyan and the highlight is white instead.
   */
  accent?: 'cyan' | 'white'
  as?: 'h1' | 'h2'
}

/**
 * The 54px section heading (Gotham 400 → Montserrat 500).
 *
 * Figma stores the two-tone colouring as per-character style overrides on a single text node —
 * "Powered by *Nature's* / Best Ingredients" highlights only one word, while "See What The /
 * *Experts Are Saying*" highlights a whole line. Modelling it as lines of runs reproduces every
 * case exactly, rather than assuming the rule is "the second line is coloured".
 *
 * The designed line breaks apply from `md` up. Below that the heading reflows naturally, since
 * a break authored for 1920px lands mid-phrase on a 320px screen.
 */
export function SectionHeading({
  lines,
  id,
  className,
  accent = 'cyan',
  as: Tag = 'h2',
}: SectionHeadingProps) {
  const accentClass = accent === 'cyan' ? 'text-brand-cyan' : 'text-white'

  return (
    // `text-wrap: normal` overrides the base `balance` on headings: the designed line breaks
    // come from the data, so letting the browser rebalance them produces a break the design
    // does not have.
    <Tag id={id} className={cn('text-h2 text-ink font-medium [text-wrap:normal]', className)}>
      {lines.map((line, lineIndex) => (
        // Lines and runs are positional content with no stable id; the index is the identity.
        // eslint-disable-next-line react/no-array-index-key
        <span key={lineIndex} className="inline md:block">
          {line.map((run, runIndex) => (
            <span key={runIndex} className={run.accent ? accentClass : undefined}>
              {run.text}
            </span>
          ))}{' '}
        </span>
      ))}
    </Tag>
  )
}
