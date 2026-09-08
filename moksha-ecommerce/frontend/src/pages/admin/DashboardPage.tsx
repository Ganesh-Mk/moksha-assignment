import { AlertTriangle, IndianRupee, Package, Users } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { ActivityChart } from "@/components/admin/ActivityChart";
import {
  METRICS,
  selectedMetrics,
  type MetricSelection,
} from "@/components/admin/metrics";
import { Container } from "@/components/layout/Container";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useActivitySeries, useAdminUsers, useDashboardStats } from "@/hooks/useOrders";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";

const RANGES = [
  { days: 7, label: "7d" },
  { days: 30, label: "30d" },
  { days: 90, label: "90d" },
];

// "All" first: it is the overview view, and an overview should open on it.
const METRIC_OPTIONS = [
  { value: "all" as const, label: "All" },
  ...METRICS.map((metric) => ({ value: metric.key, label: metric.label })),
];

/**
 * Admin overview.
 *
 * Four figures, one chart, three lists. Still deliberately small: every number
 * here answers a question an operator actually asks, and a dashboard of charts
 * nobody reads is worse than none, because it implies the numbers are being
 * watched.
 */
export function AdminDashboardPage() {
  const { data } = useDashboardStats();
  const [selection, setSelection] = useState<MetricSelection>("all");
  const [days, setDays] = useState(30);
  const { data: series, isFetching: seriesFetching } = useActivitySeries(days);
  const { data: users } = useAdminUsers(6);

  const shown = selectedMetrics(selection);
  const headline = shown.length === 1 ? shown[0]! : null;
  // A flow is summed over the window; a stock is read off the final day. Summing
  // a running total would add today's customer count to yesterday's and call the
  // result growth.
  const total =
    series === undefined || headline === null
      ? null
      : headline.kind === "flow"
        ? series.points.reduce((sum, point) => sum + headline.value(point), 0)
        : headline.value(series.points.at(-1) ?? series.points[0]!);

  // Narrowing on `data` rather than on `isPending`: TanStack's discriminated
  // union is lost once the result is destructured, so `isPending ? … : data.x`
  // does not tell the compiler `data` is defined.
  const loading = data === undefined;

  return (
    <Container className="py-8">
      <header className="mb-5">
        <p className="label-caps">Administration</p>
        <h1 className="mt-1 font-display text-2xl text-ink">Overview</h1>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Revenue"
          value={loading ? null : formatMoney(data.total_revenue_cents)}
          hint="Paid and fulfilled only"
          icon={IndianRupee}
        />
        <Stat
          label="Paid orders"
          value={loading ? null : String(data.paid_order_count)}
          hint={loading ? undefined : `of ${data.total_order_count} total`}
          icon={Package}
        />
        <Stat
          label="Customers"
          value={loading ? null : String(data.customer_count)}
          icon={Users}
        />
        <Stat
          label="Low stock"
          value={loading ? null : String(data.low_stock.length)}
          hint="10 or fewer left"
          icon={AlertTriangle}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Top customers"
            description="Biggest spender first, counting paid and fulfilled orders only."
            action={
              <Link
                to="/admin/users"
                className="text-xs text-accent underline-offset-4 hover:underline"
              >
                Manage users
              </Link>
            }
          />
          <CardBody className="flex flex-col gap-2">
            {users === undefined ? (
              <Skeleton className="h-20 w-full" />
            ) : users.items.length === 0 ? (
              <p className="text-xs text-ink-subtle">Nobody has signed up yet.</p>
            ) : (
              users.items.map((user) => (
                <div key={user.id} className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-sm text-ink">{user.name}</span>
                    {user.role === "admin" ? <Badge tone="accent">Admin</Badge> : null}
                    {!user.is_active ? <Badge tone="neutral">Disabled</Badge> : null}
                  </span>
                  <span className="tnum shrink-0 text-sm font-medium text-ink">
                    {user.total_spent_cents > 0 ? (
                      formatMoney(user.total_spent_cents)
                    ) : (
                      <span className="text-ink-subtle">—</span>
                    )}
                  </span>
                </div>
              ))
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Running low"
            description="Scarcest first."
            action={
              <Link
                to="/admin/products"
                className="text-xs text-accent underline-offset-4 hover:underline"
              >
                Manage stock
              </Link>
            }
          />
          <CardBody className="flex flex-col gap-2">
            {loading ? (
              <Skeleton className="h-20 w-full" />
            ) : data.low_stock.length === 0 ? (
              <p className="text-xs text-ink-subtle">Everything is well stocked.</p>
            ) : (
              data.low_stock.map((product) => (
                <div key={product.id} className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm text-ink">{product.name}</span>
                  <Badge tone={product.stock === 0 ? "danger" : "warning"}>
                    {product.stock} left
                  </Badge>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-4">
        <CardBody className="p-0">
          <div className="flex flex-wrap items-end justify-between gap-3 p-4 pb-2">
            <div className="min-w-0">
              <p className="label-caps">{headline ? headline.label : "Activity"}</p>
              {series === undefined ? (
                <Skeleton className="mt-1.5 h-7 w-28" />
              ) : headline && total !== null ? (
                <>
                  <p className="tnum mt-0.5 text-2xl font-semibold text-ink">
                    {headline.format(total)}
                  </p>
                  <p className="mt-1 text-2xs text-ink-subtle">
                    {headline.kind === "flow"
                      ? `Total over the last ${days} days`
                      : "Running total, today"}
                  </p>
                </>
              ) : (
                // No headline in the "All" view: there is no single number that
                // means anything across four incommensurable series. The key is
                // the tooltip, which names every series next to its colour.
                <p className="mt-1 text-2xs text-ink-subtle">Last {days} days</p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <SegmentedControl
                label="Metric"
                options={METRIC_OPTIONS}
                value={selection}
                onChange={setSelection}
              />
              <SegmentedControl
                label="Range"
                options={RANGES.map((r) => ({ value: r.days, label: r.label }))}
                value={days}
                onChange={setDays}
              />
            </div>
          </div>

          <div className="px-4 pb-3">
            {series === undefined ? (
              <Skeleton className="h-[220px] w-full" />
            ) : (
              <ActivityChart
                points={series.points}
                metrics={shown}
                // Dimmed while a new range is in flight. The old line stays put
                // rather than blanking, so switching ranges reads as the same
                // chart changing rather than a new one arriving.
                className={cn(
                  "transition-opacity duration-[--dur-base]",
                  seriesFetching && "opacity-60",
                )}
              />
            )}
          </div>
        </CardBody>
      </Card>

    </Container>
  );
}

function Stat({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string | null;
  hint?: string | undefined;
  icon: typeof Package;
}) {
  return (
    <Card>
      <CardBody className="p-3.5">
        <div className="flex items-center gap-1.5">
          <Icon className="size-3 text-ink-subtle" aria-hidden />
          <p className="label-caps">{label}</p>
        </div>
        {value === null ? (
          <Skeleton className="mt-2 h-6 w-20" />
        ) : (
          <p className="tnum mt-1.5 text-xl font-semibold text-ink">{value}</p>
        )}
        {hint ? <p className="mt-0.5 text-2xs text-ink-subtle">{hint}</p> : null}
      </CardBody>
    </Card>
  );
}

/**
 * The chart's filters.
 *
 * A radiogroup rather than a `<select>`: there are three or four options, they
 * are all short, and the current one should be visible without opening
 * anything. Generic over the value so the metric filter (strings) and the range
 * filter (numbers) are the same component rather than two that drift apart.
 */
function SegmentedControl<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex items-center gap-0.5 rounded-md border border-line bg-surface-sunken p-0.5"
    >
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-sm px-2.5 py-1 text-xs font-medium",
            "transition-[background-color,color,box-shadow] duration-[--dur-fast] ease-out",
            option.value === value
              ? "bg-surface text-ink shadow-raised"
              : "text-ink-muted hover:text-ink",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
