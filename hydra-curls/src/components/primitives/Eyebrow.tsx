import { cn } from '@/lib/utils'

interface EyebrowProps {
  children: string
  className?: string
  /** `light` is for the two bands where the eyebrow sits on cyan or a photograph. */
  tone?: 'dark' | 'light'
  /**
   * The hand-drawn swash beneath the label. Present under every eyebrow in the design
   * (Figma's `Line 21`–`Line 24`, each ~7px tall and roughly as wide as its label).
   */
  underline?: boolean
  align?: 'left' | 'center'
}

/**
 * The small handwritten label above each section heading — "New Launch", "Premium
 * Ingredients", "Designed for You". Ten of these in the design.
 *
 * Figma sets them in Guthen Bloots Personal Use, which is licensed for personal use only and
 * cannot ship. Caveat is the closest free-for-commercial handwritten face; the original's
 * +2.4px tracking is kept as an em value so it survives the fluid type scale.
 *
 * Rendered as a <p>: it reads as a label, and promoting it to a heading would insert a level
 * above the section's real <h2>.
 */
export function Eyebrow({
  children,
  className,
  tone = 'dark',
  underline = true,
  align = 'center',
}: EyebrowProps) {
  return (
    <p
      className={cn(
        'font-hand text-lead leading-script tracking-[0.1em]',
        tone === 'dark' ? 'text-black' : 'text-white',
        align === 'center' ? 'text-center' : 'text-left',
        className,
      )}
    >
      <span className="relative inline-block">
        {children}
        {underline && (
          <svg
            // Decorative flourish: the label above already carries the meaning.
            aria-hidden="true"
            focusable="false"
            viewBox="0 0 120 7"
            preserveAspectRatio="none"
            className="absolute -bottom-1.5 left-0 h-[7px] w-full"
          >
            <path
              d="M1 5.2C22 1.6 46 1.1 68 2.4c17 1 34 2.4 51 1.2"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        )}
      </span>
    </p>
  )
}
