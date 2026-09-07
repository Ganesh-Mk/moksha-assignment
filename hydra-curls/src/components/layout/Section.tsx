import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface SectionProps {
  children: ReactNode
  /** Becomes the anchor target for in-page navigation. */
  id?: string
  className?: string
  /**
   * Clips decorative art that bleeds past the section edge. On by default: the Figma file
   * positions leaves, splashes and bottles well outside their band, and an unclipped overflow
   * is the single most common source of a horizontal scrollbar on this page.
   */
  clip?: boolean
  /** Labels the section for assistive tech when its heading lives in a child component. */
  'aria-labelledby'?: string
}

/**
 * A full-width band. Vertical rhythm comes from the shared padding scale rather than each
 * section inventing its own, so the spacing between bands stays consistent as type scales.
 */
export function Section({
  children,
  id,
  className,
  clip = true,
  'aria-labelledby': labelledBy,
}: SectionProps) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={cn(
        'relative w-full py-14 md:py-20 xl:py-28',
        clip && 'overflow-hidden',
        className,
      )}
    >
      {children}
    </section>
  )
}
