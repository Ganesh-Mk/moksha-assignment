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
        className={cn('text-brand-cyan font-medium', size === 'hero' ? 'text-stat' : 'text-card')}
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
