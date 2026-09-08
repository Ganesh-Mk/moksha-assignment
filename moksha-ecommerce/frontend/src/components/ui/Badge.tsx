import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { ORDER_STATUS_LABEL } from "@/lib/format";
import type { OrderStatus } from "@/types/api";

type Tone = "neutral" | "accent" | "danger" | "warning" | "info";

const TONES: Record<Tone, string> = {
  neutral: "bg-surface-sunken text-ink-muted border-line",
  accent: "bg-accent-soft text-accent-soft-ink border-transparent",
  danger: "bg-danger-soft text-danger-soft-ink border-transparent",
  warning: "bg-warning-soft text-warning-soft-ink border-transparent",
  info: "bg-info-soft text-info-soft-ink border-transparent",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5",
        "text-2xs font-semibold uppercase tracking-(--tracking-label)",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * The order state machine, rendered.
 *
 * Colour is never the only signal — each state also has its own word. A badge
 * that distinguishes "paid" from "failed" by hue alone is unreadable to the
 * ~8% of men with a red/green deficiency, which is precisely the pair of
 * colours a status badge reaches for first.
 */
const STATUS_TONE: Record<OrderStatus, Tone> = {
  pending_payment: "warning",
  paid: "accent",
  fulfilled: "accent",
  payment_failed: "danger",
  cancelled: "neutral",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{ORDER_STATUS_LABEL[status]}</Badge>;
}
