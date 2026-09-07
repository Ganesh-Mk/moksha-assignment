import { cva, type VariantProps } from 'class-variance-authority'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * Figma's buttons are 10px-radius rectangles, not pills, and their label is Gotham 350 —
 * Montserrat 400 here, so no `font-medium`. Both measured off `Frame 4` / `Frame 5` at y1780.
 */
const brandButton = cva(
  'inline-flex items-center justify-center gap-3 rounded-[0.625rem] text-body transition-[background,color,filter] duration-200',
  {
    variants: {
      variant: {
        /** "Explore Products" — filled with the cyan gradient, white label. */
        primary: 'bg-[image:var(--gradient-cyan)] text-white hover:brightness-110',
        /** "Learn Curly Girl Method" — 1px cyan rule, cyan label. */
        outline: 'border border-brand-cyan text-brand-cyan hover:bg-brand-cyan hover:text-white',
        /** The "Learn More" pill on the benefit cards, which uses the darker gradient. */
        pill: 'bg-[image:var(--gradient-pill)] text-white hover:brightness-110',
        /** Text-only "EXPLORE NOW" on the resource cards. */
        link: 'text-brand-cyan underline-offset-4 hover:underline',
      },
      size: {
        /** 58px tall in the design; the min-height also clears the 44px tap target. */
        md: 'min-h-[3.625rem] px-4 py-4',
        sm: 'min-h-11 px-4 py-2',
        none: 'min-h-11',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

interface BrandButtonProps extends VariantProps<typeof brandButton> {
  children: ReactNode
  /**
   * Renders an anchor. Every call site on this page navigates rather than acting, so <a> is
   * the correct element — a <button> would lose middle-click, keyboard semantics and the
   * browser's own link affordances.
   */
  href: string
  className?: string
}

export function BrandButton({ children, href, variant, size, className }: BrandButtonProps) {
  return (
    <a href={href} className={cn(brandButton({ variant, size }), className)}>
      {children}
    </a>
  )
}
