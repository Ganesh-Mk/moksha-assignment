import { cn } from "@/lib/cn";

/**
 * A loading placeholder shaped like the content that will replace it.
 *
 * Shaped, not a spinner: a skeleton the same size as the real thing means the
 * page does not jump when data arrives. A spinner in a box of the wrong height
 * causes exactly the layout shift it was meant to hide.
 *
 * The shimmer is a background-position animation, so it neutralises with every
 * other animation under `prefers-reduced-motion` and leaves a plain grey block.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-md bg-surface-sunken",
        "bg-[linear-gradient(110deg,transparent_30%,var(--surface-hover)_50%,transparent_70%)]",
        "bg-[length:200%_100%] animate-[shimmer_1.4s_linear_infinite]",
        className,
      )}
      aria-hidden
    />
  );
}
