import { Slot, Slottable } from "@radix-ui/react-slot";
import { Loader2 } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * The one button in this application.
 *
 * Every variant and size is enumerated here, so a new button anywhere is a
 * choice from a fixed set rather than a fresh pile of utility classes. That is
 * what keeps twenty buttons across nine pages looking like one design instead
 * of nine.
 *
 * Notes on the details that are easy to skip and obvious when missing:
 *
 *   * `asChild` renders the styling onto a child element — used to make a
 *     react-router `<Link>` look like a button while staying an anchor, so it
 *     is still middle-clickable and still announces as a link.
 *   * While loading the button stays disabled AND keeps its width, because a
 *     button that resizes when clicked moves the thing next to it.
 *   * `aria-busy` so a screen reader announces the wait, and the spinner is
 *     `aria-hidden` because the label already says what is happening.
 */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "link";
type Size = "sm" | "md" | "lg" | "icon";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-ink border-transparent hover:bg-accent-hover active:bg-accent-active shadow-raised",
  secondary:
    "bg-surface text-ink border-line-strong hover:bg-surface-hover hover:border-ink-subtle active:bg-surface-sunken",
  ghost: "bg-transparent text-ink-muted border-transparent hover:bg-surface-hover hover:text-ink",
  danger: "bg-danger text-white border-transparent hover:bg-danger-hover shadow-raised",
  link: "bg-transparent border-transparent text-accent underline underline-offset-4 decoration-line-strong hover:decoration-accent p-0 h-auto",
};

const SIZES: Record<Size, string> = {
  sm: "h-7 px-2.5 text-xs gap-1.5 rounded-sm",
  md: "h-9 px-3.5 text-sm gap-2 rounded-md",
  lg: "h-11 px-5 text-base gap-2 rounded-md",
  icon: "h-9 w-9 justify-center rounded-md",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  asChild?: boolean;
  /** Rendered before the label. Hidden from assistive tech — the label carries the meaning. */
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", loading, asChild, icon, children, ...props },
  ref,
) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      ref={ref}
      className={cn(
        "inline-flex select-none items-center border font-medium",
        "transition-[background-color,border-color,color,box-shadow,transform]",
        "duration-(--dur-fast) ease-out",
        // A 1px press. Enough to feel like a physical control, small enough
        // that nobody consciously notices it.
        "active:translate-y-px",
        "disabled:pointer-events-none disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      aria-busy={loading || undefined}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? (
        <Loader2
          className="size-3.5 shrink-0 animate-[spin_var(--dur-slow)_linear_infinite]"
          aria-hidden
        />
      ) : (
        icon
      )}
      {/* Slottable is required whenever `asChild` is used alongside sibling
          content: Slot merges its props onto exactly one child, and an icon
          next to the children would otherwise be a second one. This marks
          which child is the real target. */}
      <Slottable>{children}</Slottable>
    </Comp>
  );
});
