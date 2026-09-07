import type { RichText } from '@/content/sections'
import { cn } from '@/lib/utils'

interface RichParagraphProps {
  runs: RichText
  className?: string
}

/**
 * A paragraph whose highlighted runs come from data rather than from markup.
 *
 * Figma stores inline emphasis as character-style overrides on a single text node, so the
 * highlighted span is a property of the copy, not of the layout — which is exactly why it
 * belongs in src/content and not inside a section component.
 */
export function RichParagraph({ runs, className }: RichParagraphProps) {
  return (
    <p className={className}>
      {runs.map((run) => (
        <span key={run.text} className={cn(run.accent && 'text-brand-cyan')}>
          {run.text}
        </span>
      ))}
    </p>
  )
}
