import { cva, type VariantProps } from 'class-variance-authority'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * Figma's buttons are 10px-radius rectangles, not pills, and their label is Gotham 350 —
 * Montserrat 400 here, so no `font-medium`. Both measured off `Frame 4` / `Frame 5` at y1780.
 */
const brandButton = cva(
  // `transform` and `box-shadow` only on hover — no size or spacing changes, so a hover can
  // never nudge the layout around it.
  //
  // The lift is 1px and the shadow is a low-opacity neutral, not a coloured glow. The first
  // attempt used a full-strength cyan halo; at button scale that reads as a selection state or
  // an error, not as elevation. Real products cast a soft dark shadow — the brand colour
  // belongs in the fill, not in the light around it.
  [
    'inline-flex items-center justify-center gap-3 rounded-[0.625rem] text-body',
    'transition-[background,color,filter,transform,box-shadow] duration-200 ease-out',
    'hover:-translate-y-px active:translate-y-0 motion-reduce:hover:translate-y-0',
  ],
  {
    variants: {
      variant: {
        /** "Explore Products" — filled with the cyan gradient, white label. */
        primary:
          'bg-[image:var(--gradient-cyan)] text-white shadow-[0_0.0625rem_0.125rem_rgb(4_12_30/0.08)] hover:shadow-[0_0.375rem_1rem_-0.5rem_rgb(4_12_30/0.28)] hover:brightness-[1.06]',
        /** "Learn Curly Girl Method" — 1px cyan rule, cyan label. */
        outline:
          'border border-brand-cyan text-brand-cyan-ink-body hover:bg-brand-cyan hover:text-white hover:shadow-[0_0.375rem_1rem_-0.5rem_rgb(4_12_30/0.22)]',
        /** The "Learn More" pill on the benefit cards, which uses the darker gradient. */
        pill: 'bg-[image:var(--gradient-pill)] text-white shadow-[0_0.0625rem_0.125rem_rgb(4_12_30/0.08)] hover:shadow-[0_0.375rem_1rem_-0.5rem_rgb(4_12_30/0.28)] hover:brightness-[1.06]',
        /**
         * Text-only "EXPLORE NOW" on the resource cards. The underline is a scaled
         * pseudo-element rather than `text-decoration`, so it sweeps in from the left instead
         * of appearing all at once, and any arrow inside the label slides with it.
         */
        link: [
          'relative w-fit text-brand-cyan-ink-body',
          'after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:bg-current',
          'after:scale-x-0 after:transition-transform after:duration-300 hover:after:scale-x-100',
          '[&_svg]:transition-transform [&_svg]:duration-300 hover:[&_svg]:translate-x-1',
          'motion-reduce:hover:[&_svg]:translate-x-0',
        ],
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
