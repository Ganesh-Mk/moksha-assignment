import { Check, CircleDashed, X } from "lucide-react";

import { cn } from "@/lib/cn";
import { ORDER_STATUS_LABEL } from "@/lib/format";
import type { OrderStatus } from "@/types/api";

/**
 * The order state machine, made visible.
 *
 * The happy path is three steps. A terminal failure replaces the remaining
 * steps rather than being appended to them, because "cancelled" is not a stage
 * *after* "paid" — it is where the order stopped. Drawing it as a fourth step
 * would suggest a cancelled order had been paid.
 */

const HAPPY_PATH: OrderStatus[] = ["pending_payment", "paid", "fulfilled"];
const FAILED: OrderStatus[] = ["payment_failed", "cancelled"];

const DESCRIPTIONS: Record<OrderStatus, string> = {
  pending_payment: "Waiting for payment. Stock is reserved for you.",
  paid: "Payment confirmed by Stripe's signed webhook.",
  fulfilled: "Dispatched.",
  payment_failed: "The payment did not complete. Stock was returned.",
  cancelled: "Cancelled. Stock was returned to the catalogue.",
};

export function OrderTimeline({ status }: { status: OrderStatus }) {
  const failed = FAILED.includes(status);
  const reachedIndex = failed ? 0 : HAPPY_PATH.indexOf(status);

  const steps: { status: OrderStatus; state: "done" | "current" | "upcoming" | "failed" }[] = failed
    ? [
        { status: "pending_payment", state: "done" },
        { status, state: "failed" },
      ]
    : HAPPY_PATH.map((step, index) => ({
        status: step,
        state: index < reachedIndex ? "done" : index === reachedIndex ? "current" : "upcoming",
      }));

  return (
    <ol className="flex flex-col gap-0">
      {steps.map((step, index) => {
        const last = index === steps.length - 1;
        return (
          <li key={step.status} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border",
                  step.state === "done" && "border-accent bg-accent text-accent-ink",
                  step.state === "current" && "border-accent bg-accent-soft text-accent",
                  step.state === "upcoming" && "border-line bg-surface text-ink-subtle",
                  step.state === "failed" && "border-danger bg-danger-soft text-danger",
                )}
              >
                {step.state === "failed" ? (
                  <X className="size-3" aria-hidden />
                ) : step.state === "upcoming" ? (
                  <CircleDashed className="size-3" aria-hidden />
                ) : (
                  <Check className="size-3" aria-hidden />
                )}
              </span>
              {!last ? (
                <span
                  className={cn(
                    "w-px flex-1",
                    step.state === "done" ? "bg-accent" : "bg-line",
                  )}
                />
              ) : null}
            </div>

            <div className={cn("pb-4", last && "pb-0")}>
              <p
                className={cn(
                  "text-sm",
                  step.state === "upcoming" ? "text-ink-subtle" : "font-medium text-ink",
                )}
              >
                {ORDER_STATUS_LABEL[step.status]}
              </p>
              <p className="mt-0.5 text-xs text-ink-muted">{DESCRIPTIONS[step.status]}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
