import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

interface FeatureBadgeProps {
  children: string
  icon: LucideIcon
  className?: string
}

/**
 * The three claim pills under the New Launch intro — "No SLS, Silicones, Parabens",
 * "48-Hour Hydration", "Hair Types 2, 3, 4".
 *
 * Measured from `Frame 1`–`Frame 3` at y1716: a 10px-radius rectangle on cyan at 6% opacity,
 * with a cyan 19px icon and 16px grey label.
 */
export function FeatureBadge({ children, icon: Icon, className }: FeatureBadgeProps) {
  return (
    <li
      className={cn(
        // One step darker than the #737373 the design uses for secondary text: the 6% cyan tint
        // behind this label drops the pair to ~4.4:1, just under the bar. The difference is
        // imperceptible; the audit failure is not.
        'bg-brand-cyan/6 text-grey-700 flex items-center gap-2.5 rounded-[0.625rem] px-3 py-2.5 text-xs',
        className,
      )}
    >
      <Icon aria-hidden="true" className="text-brand-cyan size-[1.1875rem] shrink-0" />
      {children}
    </li>
  )
}
