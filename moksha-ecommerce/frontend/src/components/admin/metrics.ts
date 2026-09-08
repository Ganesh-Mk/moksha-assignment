import { formatMoney } from "@/lib/format";
import type { TimeSeriesPoint } from "@/types/api";

/**
 * The four series the activity chart can draw.
 *
 * A separate module from the chart component for the same reason `authContext` is separate from
 * its provider: a file that exports both a component and a constant breaks React Fast Refresh, so
 * every edit to the chart would reload the page instead of hot-swapping.
 *
 * Two fields carry the thinking.
 *
 * **`kind`** — revenue and orders are *flows* (what happened that day), customers and products are
 * *stocks* (how many existed by the end of it). It decides whether the headline is a sum over the
 * window or the final value, and whether the axis is anchored at zero.
 *
 * **`axis`** — which of the chart's two scales the series belongs to. Money and counts are not the
 * same quantity and cannot share a scale: ₹1,698 and 3 customers on one axis draws the customers
 * as a flat line on the floor. So the "All" view has a rupee axis on the left and a count axis on
 * the right, which is the standard honest way to show both, and every series says which one it is
 * measured against.
 */
export type MetricKey = "revenue" | "orders" | "customers" | "products";

export interface Metric {
  key: MetricKey;
  label: string;
  kind: "flow" | "stock";
  axis: "money" | "count";
  /** A CSS custom property, so the palette lives in the token layer with everything else. */
  color: string;
  value: (point: TimeSeriesPoint) => number;
  format: (value: number) => string;
}

export const METRICS: Metric[] = [
  {
    key: "revenue",
    label: "Revenue",
    kind: "flow",
    axis: "money",
    color: "var(--chart-revenue)",
    value: (point) => point.revenue_cents,
    format: (value) => formatMoney(value),
  },
  {
    key: "orders",
    label: "Orders",
    kind: "flow",
    axis: "count",
    color: "var(--chart-orders)",
    value: (point) => point.orders,
    format: String,
  },
  {
    key: "customers",
    label: "Customers",
    kind: "stock",
    axis: "count",
    color: "var(--chart-customers)",
    value: (point) => point.customers,
    format: String,
  },
  {
    key: "products",
    label: "Products",
    kind: "stock",
    axis: "count",
    color: "var(--chart-products)",
    value: (point) => point.products,
    format: String,
  },
];

/** `null` is the "All" view — every series at once, on the two axes. */
export type MetricSelection = MetricKey | "all";

export function selectedMetrics(selection: MetricSelection): Metric[] {
  return selection === "all" ? METRICS : METRICS.filter((m) => m.key === selection);
}
