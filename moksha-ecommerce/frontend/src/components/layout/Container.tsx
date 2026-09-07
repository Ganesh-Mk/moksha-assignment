import type { HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

/**
 * Page width, in one place.
 *
 * `narrow` is for reading-width content — an order, the checkout result —
 * where a full-width column would run to 140 characters and be unpleasant to
 * read. Everything else uses the default.
 */
export function Container({
  narrow,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { narrow?: boolean }) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 sm:px-6",
        narrow ? "max-w-[var(--container-narrow)]" : "max-w-[var(--container-page)]",
        className,
      )}
      {...props}
    />
  );
}
