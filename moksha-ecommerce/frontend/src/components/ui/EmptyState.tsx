import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * The "there is nothing here" state.
 *
 * A shared component because an empty state is where an interface either helps
 * or abandons someone, and the difference is entirely in whether it offers the
 * next action. "No orders yet" is a dead end; "No orders yet — browse the
 * range" is a route forward. Making the action a first-class prop is what stops
 * it being skipped.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-14 text-center",
        className,
      )}
    >
      <div className="rounded-full border border-line bg-surface-sunken p-3">
        <Icon className="size-5 text-ink-subtle" aria-hidden />
      </div>
      <div className="max-w-xs">
        <p className="text-sm font-medium text-ink">{title}</p>
        {description ? <p className="mt-1 text-xs text-ink-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
