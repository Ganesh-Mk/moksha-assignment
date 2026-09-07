import type { OrderStatus } from "@/types/api";

/**
 * The only place integer cents become a human-readable amount.
 *
 * Money crosses the wire as an integer and stays an integer everywhere in this
 * codebase (DECISIONS D-004). This function is the single boundary where it
 * becomes a string for display — nothing else divides by 100.
 */
export function formatMoney(cents: number, currency = "INR"): string {
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** "2 hours ago" — for the order timeline, where elapsed time reads better than a date. */
export function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const seconds = Math.round((then - Date.now()) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["day", 86_400],
    ["hour", 3600],
    ["minute", 60],
  ];
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return formatter.format(Math.round(seconds / size), unit);
  }
  return formatter.format(Math.round(seconds), "second");
}

/** Human labels for the order state machine. Defined once; the enum is the server's. */
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: "Awaiting payment",
  paid: "Paid",
  fulfilled: "Fulfilled",
  payment_failed: "Payment failed",
  cancelled: "Cancelled",
};

export function pluralise(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
