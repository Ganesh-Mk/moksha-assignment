import { cn } from '@/lib/utils'

interface StatBlockProps {
  value: string
  label: string
  className?: string
  /** `hero` is the 162px "48" in the promise band; `compact` is the final-CTA grid. */
  size?: 'hero' | 'compact'
}

/**
 * A number over its label.
 *
 * The value and label are one semantic unit, so they are marked up as a description list pair
 * rather than two loose divs — a screen reader then announces "48, Hours" instead of two
 * unrelated fragments.
 */
export function StatBlock({ value, label, className, size = 'compact' }: StatBlockProps) {
  return (
    <div className={cn('text-center', className)}>
      <dt className="sr-only">{label}</dt>
      <dd
        // Animated by the inline count-up script in index.html. These sections are static
        // HTML and never hydrate, so this cannot be a React hook.
        data-countup=""
        className={cn(
          'font-medium',
          // `hero` sits on the pale promise band and needs the readable cyan; `compact` sits
          // on the navy CTA, where the full-strength brand cyan has plenty of contrast.
          size === 'hero' ? 'text-stat text-brand-cyan-ink' : 'text-card text-brand-cyan',
        )}
      >
        {value}
      </dd>
      <p
        aria-hidden="true"
        className={cn('text-body', size === 'hero' ? 'text-ink' : 'text-white')}
      >
        {label}
      </p>
    </div>
  )
}
