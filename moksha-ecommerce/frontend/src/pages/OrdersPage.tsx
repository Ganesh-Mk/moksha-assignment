import { Package } from "lucide-react";
import { Link } from "react-router-dom";

import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";
import { OrderStatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProductThumbStack } from "@/components/product/ProductThumb";
import { Skeleton } from "@/components/ui/Skeleton";
import { useMyOrders } from "@/hooks/useOrders";
import { cn } from "@/lib/cn";
import { formatDate, formatMoney, pluralise } from "@/lib/format";

/**
 * Order history.
 *
 * Scoped to the caller by the server — `GET /orders` filters on the JWT's
 * subject in a WHERE clause, so there is nothing here that could show another
 * customer's order even if this component asked for one.
 */
export function OrdersPage() {
  const { data, isPending, isError, error, refetch } = useMyOrders({ limit: 20 });

  return (
    <Container className="py-8">
      <header className="mb-5">
        <p className="label-caps">Account</p>
        <h1 className="mt-1 font-display text-2xl text-ink">Your orders</h1>
      </header>

      {isError ? (
        <EmptyState
          icon={Package}
          title="Could not load your orders"
          description={error.message}
          action={
            <Button variant="secondary" size="sm" onClick={() => void refetch()}>
              Try again
            </Button>
          }
        />
      ) : isPending ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No orders yet"
          description="When you buy something it will appear here, with its live status."
          action={
            <Button asChild size="sm">
              <Link to="/products">Browse the range</Link>
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {data.items.map((order) => (
            <li key={order.id}>
              <Card
                className={cn(
                  "transition-[border-color,box-shadow] duration-(--dur-fast)",
                  "hover:border-line-strong hover:shadow-raised",
                )}
              >
                <Link
                  to={`/orders/${order.id}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4"
                >
                  <ProductThumbStack images={order.items.map((item) => item.product_image_url)} />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="tnum text-sm font-semibold text-ink">#{order.id}</span>
                      <OrderStatusBadge status={order.status} />
                    </div>
                    <p className="mt-1 truncate text-xs text-ink-muted">
                      {formatDate(order.created_at)} ·{" "}
                      {pluralise(
                        order.items.reduce((total, item) => total + item.quantity, 0),
                        "item",
                      )}{" "}
                      · {order.items.map((item) => item.product_name).join(", ")}
                    </p>
                  </div>
                  <span className="tnum text-sm font-semibold text-ink">
                    {formatMoney(order.total_cents, order.currency)}
                  </span>
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
