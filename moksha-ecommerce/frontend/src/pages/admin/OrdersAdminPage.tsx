import { Package } from "lucide-react";
import { useState } from "react";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Container } from "@/components/layout/Container";
import { OrderStatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/toastContext";
import { useAdminOrders, useUpdateOrderStatus } from "@/hooks/useOrders";
import { ApiError } from "@/lib/api";
import { ORDER_STATUS_LABEL, formatDateTime, formatMoney } from "@/lib/format";
import type { AdminOrder, OrderStatus } from "@/types/api";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  ...(Object.keys(ORDER_STATUS_LABEL) as OrderStatus[]).map((status) => ({
    value: status,
    label: ORDER_STATUS_LABEL[status],
  })),
];

/**
 * Every order, from every customer.
 *
 * The status controls are driven by `allowed_transitions`, which the server
 * publishes on each order. That is the point of exposing it: the admin UI shows
 * exactly the moves the state machine will accept, instead of keeping a second
 * copy of the rules that drifts from the first.
 */
export function AdminOrdersPage() {
  const [status, setStatus] = useState("all");
  const { data } = useAdminOrders({
    ...(status !== "all" ? { status } : {}),
    limit: 50,
  });

  return (
    <Container className="py-8">
      <AdminPageHeader title="Orders">
        <Select
          label="Filter by status"
          hideLabel
          value={status}
          onValueChange={setStatus}
          options={STATUS_OPTIONS}
          className="w-48"
        />
      </AdminPageHeader>

      {data === undefined ? (
        <Skeleton className="h-64 w-full" />
      ) : data.items.length === 0 ? (
        <EmptyState icon={Package} title="No orders" description="Nothing matches that filter." />
      ) : (
        <div className="flex flex-col gap-2">
          {data.items.map((order) => (
            <AdminOrderRow key={order.id} order={order} />
          ))}
        </div>
      )}
    </Container>
  );
}

function AdminOrderRow({ order }: { order: AdminOrder }) {
  const update = useUpdateOrderStatus();
  const toast = useToast();

  async function moveTo(next: OrderStatus) {
    try {
      await update.mutateAsync({ id: order.id, status: next });
      toast.success(
        `Order #${order.id} → ${ORDER_STATUS_LABEL[next]}`,
        next === "cancelled" ? "Stock has been returned to the catalogue." : undefined,
      );
    } catch (error) {
      toast.error(
        "Could not update the order",
        error instanceof ApiError ? error.message : "Try again.",
      );
    }
  }

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="tnum text-sm font-semibold text-ink">#{order.id}</span>
            <OrderStatusBadge status={order.status} />
            <span className="text-xs text-ink-subtle">{formatDateTime(order.created_at)}</span>
          </div>

          <p className="mt-1 truncate text-xs text-ink-muted">
            {order.user.name} · {order.user.email}
          </p>

          <ul className="mt-2 flex flex-col gap-0.5">
            {order.items.map((item) => (
              <li key={item.id} className="tnum text-xs text-ink-muted">
                {item.quantity} × {item.product_name} —{" "}
                {formatMoney(item.line_total_cents, order.currency)}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col items-end gap-2">
          <span className="tnum text-base font-semibold text-ink">
            {formatMoney(order.total_cents, order.currency)}
          </span>

          {order.allowed_transitions.length > 0 ? (
            <div className="flex flex-wrap justify-end gap-1.5">
              {order.allowed_transitions.map((next) => (
                <Button
                  key={next}
                  size="sm"
                  variant={next === "cancelled" ? "ghost" : "secondary"}
                  onClick={() => void moveTo(next)}
                  loading={update.isPending}
                >
                  {ORDER_STATUS_LABEL[next]}
                </Button>
              ))}
            </div>
          ) : (
            <span className="text-2xs text-ink-subtle">Final state</span>
          )}
        </div>
      </div>
    </Card>
  );
}
