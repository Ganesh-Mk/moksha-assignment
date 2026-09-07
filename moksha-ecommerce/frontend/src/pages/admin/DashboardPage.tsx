import { AlertTriangle, IndianRupee, Package, Users } from "lucide-react";
import { Link } from "react-router-dom";

import { Container } from "@/components/layout/Container";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useDashboardStats } from "@/hooks/useOrders";
import { ORDER_STATUS_LABEL, formatMoney } from "@/lib/format";
import type { OrderStatus } from "@/types/api";

/**
 * Admin overview.
 *
 * Four figures and two lists — deliberately small. Every number here answers a
 * question an operator actually asks, and a dashboard of charts nobody reads is
 * worse than none, because it implies the numbers are being watched.
 */
export function AdminDashboardPage() {
  const { data } = useDashboardStats();

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
            title="Orders by status"
            description="Revenue counts only paid and fulfilled — a pending order is not money."
          />
          <CardBody className="flex flex-col gap-2">
            {loading ? (
              <Skeleton className="h-20 w-full" />
            ) : data.orders_by_status.length === 0 ? (
              <p className="text-xs text-ink-subtle">No orders yet.</p>
            ) : (
              data.orders_by_status.map((row) => (
                <div key={row.status} className="flex items-center justify-between gap-3">
                  <Badge tone="neutral">
                    {ORDER_STATUS_LABEL[row.status as OrderStatus] ?? row.status}
                  </Badge>
                  <span className="tnum text-sm font-medium text-ink">{row.count}</span>
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
