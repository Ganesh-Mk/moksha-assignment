import { cn } from '@/lib/utils'

interface ScrollCueProps {
  /** Where the cue scrolls to. */
  href: string
  label: string
  className?: string
}

/**
 * The double chevron at the foot of the hero (Figma stacks two `icon-park-outline:down`
 * frames 15px apart).
 *
 * A real link rather than a decorative glyph, so it works with a keyboard and actually moves
 * the page — the design implies the affordance and leaving it inert would be a broken promise.
 */
export function ScrollCue({ href, label, className }: ScrollCueProps) {
  return (
    <a
      href={href}
      className={cn(
        'inline-flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5',
        className,
      )}
    >
      <span className="sr-only">{label}</span>
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 30 45"
        className="h-9 w-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 10 L15 19 L24 10" />
        <path d="M6 25 L15 34 L24 25" />
      </svg>
    </a>
  )
}
