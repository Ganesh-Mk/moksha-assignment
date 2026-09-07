import { ArrowLeft, CreditCard, Package } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { Container } from "@/components/layout/Container";
import { OrderTimeline } from "@/components/order/OrderTimeline";
import { OrderStatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Dialog, DialogContent, DialogClose, DialogTrigger } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/toastContext";
import { useCancelOrder, useCheckout, useOrder } from "@/hooks/useOrders";
import { ApiError } from "@/lib/api";
import { formatDateTime, formatMoney } from "@/lib/format";

export function OrderDetailPage() {
  const { id } = useParams();
  const orderId = Number(id) || undefined;
  const toast = useToast();

  // Poll while unpaid: this page is where a customer lands after cancelling at
  // Stripe, and the order may still settle behind them.
  const { data: order, isPending, isError } = useOrder(orderId, { pollUntilSettled: true });
  const cancel = useCancelOrder();
  const checkout = useCheckout();
  const [payBusy, setPayBusy] = useState(false);

  if (isPending) {
    return (
      <Container narrow className="py-8">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="mt-4 h-48 w-full" />
      </Container>
    );
  }

  if (isError || !order) {
    return (
      <Container narrow className="py-8">
        {/* The server returns 404 for another customer's order rather than 403,
            so this same screen covers "does not exist" and "not yours" — which
            is exactly the indistinguishability the API is going for. */}
        <EmptyState
          icon={Package}
          title="Order not found"
          description="It does not exist, or it belongs to a different account."
          action={
            <Button asChild variant="secondary" size="sm">
              <Link to="/orders">Back to my orders</Link>
            </Button>
          }
        />
      </Container>
    );
  }

  const unpaid = order.status === "pending_payment";

  async function handlePay() {
    if (!order) return;
    setPayBusy(true);
    try {
      const session = await checkout.mutateAsync(order.id);
      window.location.href = session.checkout_url;
    } catch (error) {
      toast.error(
        "Could not start checkout",
        error instanceof ApiError ? error.message : "Please try again.",
      );
      setPayBusy(false);
    }
  }

  async function handleCancel() {
    if (!order) return;
    try {
      await cancel.mutateAsync(order.id);
      toast.success("Order cancelled", "The items have been returned to stock.");
    } catch (error) {
      toast.error(
        "Could not cancel",
        error instanceof ApiError ? error.message : "Please try again.",
      );
    }
  }

  return (
    <Container narrow className="py-6 sm:py-8">
      <Link
        to="/orders"
        className="mb-5 inline-flex items-center gap-1.5 rounded-sm text-xs text-ink-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        All orders
      </Link>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-2xl text-ink">Order #{order.id}</h1>
            <OrderStatusBadge status={order.status} />
          </div>
          <p className="mt-1 text-xs text-ink-muted">Placed {formatDateTime(order.created_at)}</p>
        </div>

        {unpaid ? (
          <div className="flex gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm">
                  Cancel
                </Button>
              </DialogTrigger>
              <DialogContent
                title="Cancel this order?"
                description="The reserved items go back to the catalogue. This cannot be undone."
                footer={
                  <>
                    <DialogClose asChild>
                      <Button variant="secondary" size="sm">
                        Keep it
                      </Button>
                    </DialogClose>
                    <DialogClose asChild>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => void handleCancel()}
                        loading={cancel.isPending}
                      >
                        Cancel order
                      </Button>
                    </DialogClose>
                  </>
                }
              >
                <p className="text-sm text-ink-muted">
                  Only unpaid orders can be cancelled here. A paid order needs a refund, which an
                  administrator has to process.
                </p>
              </DialogContent>
            </Dialog>

            <Button
              size="sm"
              onClick={() => void handlePay()}
              loading={payBusy}
              icon={<CreditCard className="size-3.5" aria-hidden />}
            >
              Pay now
            </Button>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_16rem]">
        <Card>
          <CardHeader title="Items" />
          <ul className="divide-y divide-line">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-baseline gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  {/* The snapshot, not the product's current name — this is
                      what the customer actually bought. */}
                  <p className="truncate text-sm text-ink">{item.product_name}</p>
                  <p className="tnum mt-0.5 text-xs text-ink-muted">
                    {item.quantity} × {formatMoney(item.unit_price_cents, order.currency)}
                  </p>
                </div>
                <span className="tnum text-sm font-medium text-ink">
                  {formatMoney(item.line_total_cents, order.currency)}
                </span>
              </li>
            ))}
          </ul>
          <CardBody className="flex items-baseline justify-between border-t border-line bg-surface-sunken">
            <span className="text-sm font-medium text-ink">Total</span>
            <span className="tnum text-lg font-semibold text-ink">
              {formatMoney(order.total_cents, order.currency)}
            </span>
          </CardBody>
        </Card>

        <Card className="h-fit">
          <CardHeader title="Progress" />
          <CardBody>
            <OrderTimeline status={order.status} />
          </CardBody>
        </Card>
      </div>
    </Container>
  );
}
