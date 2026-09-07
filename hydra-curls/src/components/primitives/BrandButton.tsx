import { cva, type VariantProps } from 'class-variance-authority'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

const brandButton = cva(
  // min-h-11 is 44px — the minimum comfortable tap target, which the 20px-type buttons in the
  // design would not otherwise reach on mobile.
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-full text-body font-medium transition-colors',
  {
    variants: {
      variant: {
        /** Filled cyan — "Explore Products". */
        primary: 'bg-brand-cyan text-white hover:bg-brand-cyan-deepest',
        /** Outlined — "Learn Curly Girl Method". */
        outline: 'border border-brand-cyan text-brand-cyan hover:bg-brand-cyan hover:text-white',
        /** The gradient "Learn More" pill on the benefit cards. */
        pill: 'bg-[image:var(--gradient-pill)] text-white hover:brightness-110',
        /** Text-only "EXPLORE NOW" on the resource cards. */
        link: 'text-brand-cyan underline-offset-4 hover:underline',
      },
      size: {
        md: 'px-6 py-3',
        lg: 'px-8 py-4',
        none: '',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

interface BrandButtonProps extends VariantProps<typeof brandButton> {
  children: ReactNode
  /**
   * Renders an anchor. Every call site on this page navigates rather than acting, so an <a>
   * is the correct element — a <button> here would lose middle-click, keyboard semantics and
   * the browser's own link affordances.
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
