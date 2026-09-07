import type { ElementType, ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface ContainerProps {
  children: ReactNode
  className?: string
  /** Defaults to `div`; pass `header`/`footer` where the container *is* the landmark. */
  as?: ElementType
}

/**
 * The content column, matching Figma's layout grid: 12 columns with a 120px side margin at
 * 1920px, which leaves 1680px of content. Below that the margin steps down so small screens
 * are not mostly gutter.
 *
 * Content never breaks out of this. Full-bleed decorative bands sit *outside* it — that split
 * is what keeps the page from developing a horizontal scrollbar at an untested width.
 */
export function Container({ children, className, as: Tag = 'div' }: ContainerProps) {
  return (
    <Tag className={cn('max-w-content xl:px-gutter mx-auto w-full px-5 md:px-10', className)}>
      {children}
    </Tag>
  )
}
