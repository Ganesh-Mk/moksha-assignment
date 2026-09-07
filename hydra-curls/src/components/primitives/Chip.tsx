import { Check } from 'lucide-react'

import { cn } from '@/lib/utils'

interface ChipProps {
  children: string
  className?: string
  /**
   * Figma uses two tick colours: cyan inside the ingredient cards, green (#34C759) on the
   * trust bar. Same shape, different semantics — a benefit versus a guarantee.
   */
  tone?: 'cyan' | 'green'
}

/**
 * A ticked benefit line: the nine chips inside the ingredient cards ("Deep Hydration",
 * "Curl Definition", …) and the five trust badges below them ("No SLS", "Cruelty Free", …).
 */
export function Chip({ children, className, tone = 'cyan' }: ChipProps) {
  return (
    <li className={cn('text-body text-ink flex items-center gap-2', className)}>
      <Check
        // The visible label already says what this is; the tick is pure decoration.
        aria-hidden="true"
        className={cn(
          'size-4 shrink-0 rounded-full p-px',
          tone === 'cyan' ? 'text-brand-cyan' : 'text-success',
        )}
        strokeWidth={3}
      />
      {children}
    </li>
  )
}
