import { formatMoney } from "@/lib/format";
import type { TimeSeriesPoint } from "@/types/api";

/**
 * The four series the activity chart can draw.
 *
 * A separate module from the chart component for the same reason `authContext`
 * is separate from its provider: a file that exports both a component and a
 * constant breaks React Fast Refresh, so every edit to the chart would reload
 * the page instead of hot-swapping.
 *
 * `kind` is the important field. Revenue and orders are **flows** — what
 * happened on that day — so the headline is their sum over the window and the
 * y-axis is anchored at zero. Customers and products are **stocks** — how many
 * existed by the end of it — so the headline is the final value and the axis
 * need not start at zero. Plotting the two kinds on one pair of axes is how a
 * chart lies without anyone writing a false number.
 */
export type MetricKey = "revenue" | "orders" | "customers" | "products";

export interface Metric {
  key: MetricKey;
  label: string;
  kind: "flow" | "stock";
  value: (point: TimeSeriesPoint) => number;
  format: (value: number) => string;
}

export const METRICS: Metric[] = [
  {
    key: "revenue",
    label: "Revenue",
    kind: "flow",
    value: (point) => point.revenue_cents,
    format: (value) => formatMoney(value),
  },
  {
    key: "orders",
    label: "Orders",
    kind: "flow",
    value: (point) => point.orders,
    format: String,
  },
  {
    key: "customers",
    label: "Customers",
    kind: "stock",
    value: (point) => point.customers,
    format: String,
  },
  {
    key: "products",
    label: "Products",
    kind: "stock",
    value: (point) => point.products,
    format: String,
  },
];
