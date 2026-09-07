import { AlertTriangle, ArrowRight, Check, Loader2, ShoppingBag } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { useOrder } from "@/hooks/useOrders";
import { formatMoney } from "@/lib/format";

/**
 * Where Stripe sends the customer back to.
 *
 * **The redirect proves nothing.** It is a client-side navigation, and anyone
 * can type this URL. So this page does not say "paid" because Stripe sent the
 * browser here — it polls `GET /orders/{id}` until the *webhook* has moved the
 * order out of `pending_payment` (DECISIONS D-010).
 *
 * That is why there is a "confirming your payment" state at all. It is honest,
 * it is what real checkouts do, and showing a green tick straight away would
 * mean the page was lying whenever the webhook was slow — or absent.
 */
export function CheckoutSuccessPage() {
  const [params] = useSearchParams();
  const orderId = Number(params.get("order_id")) || undefined;

  const { data: order, isPending } = useOrder(orderId, { pollUntilSettled: true });

  const confirming = isPending || order?.status === "pending_payment";
  const paid = order?.status === "paid" || order?.status === "fulfilled";
  const failed = order?.status === "payment_failed" || order?.status === "cancelled";

  return (
    <Container narrow className="py-14">
      <Card>
        <CardBody className="flex flex-col items-center gap-4 py-10 text-center">
          {confirming ? (
            <>
              <Loader2
                className="size-7 animate-[spin_var(--dur-slow)_linear_infinite] text-ink-subtle"
                aria-hidden
              />
              <div>
                <h1 className="font-display text-2xl text-ink">Confirming your payment</h1>
                <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-muted">
                  Stripe has taken the payment and is telling our server about it. This usually
                  takes a second or two — the page will update itself.
                </p>
              </div>
              <p className="max-w-sm text-2xs leading-snug text-ink-subtle">
                We wait for Stripe's signed webhook rather than trusting the redirect that brought
                you here, because a browser redirect is not proof of payment.
              </p>
            </>
          ) : paid ? (
            <>
              <div className="rounded-full bg-accent-soft p-3 animate-[scale-in_var(--dur-base)_var(--ease-spring)]">
                <Check className="size-6 text-accent" aria-hidden />
              </div>
              <div>
                <h1 className="font-display text-2xl text-ink">Payment confirmed</h1>
                <p className="mt-1.5 text-sm text-ink-muted">
                  Order #{order.id} · {formatMoney(order.total_cents, order.currency)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button asChild>
                  <Link to={`/orders/${order.id}`}>
                    View order <ArrowRight className="size-3.5" aria-hidden />
                  </Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link to="/products">Keep shopping</Link>
                </Button>
              </div>
            </>
          ) : failed ? (
            <>
              <div className="rounded-full bg-danger-soft p-3">
                <AlertTriangle className="size-6 text-danger" aria-hidden />
              </div>
              <div>
                <h1 className="font-display text-2xl text-ink">Payment did not go through</h1>
                <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-muted">
                  Nothing was charged, and the items have been returned to stock. You can try
                  again from your orders.
                </p>
              </div>
              <Button asChild variant="secondary">
                <Link to="/orders">Go to my orders</Link>
              </Button>
            </>
          ) : (
            <>
              <ShoppingBag className="size-7 text-ink-subtle" aria-hidden />
              <div>
                <h1 className="font-display text-2xl text-ink">We could not find that order</h1>
                <p className="mt-1.5 text-sm text-ink-muted">
                  It may belong to a different account.
                </p>
              </div>
              <Button asChild variant="secondary">
                <Link to="/orders">Go to my orders</Link>
              </Button>
            </>
          )}
        </CardBody>
      </Card>
    </Container>
  );
}

/** Where Stripe sends the customer if they back out of the payment page. */
export function CheckoutCancelledPage() {
  const [params] = useSearchParams();
  const orderId = params.get("order_id");

  return (
    <Container narrow className="py-14">
      <Card>
        <CardBody className="flex flex-col items-center gap-4 py-10 text-center">
          <div className="rounded-full bg-surface-sunken p-3">
            <ShoppingBag className="size-6 text-ink-subtle" aria-hidden />
          </div>
          <div>
            <h1 className="font-display text-2xl text-ink">Checkout cancelled</h1>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-muted">
              Nothing was charged. Your order is still waiting for payment — the items stay
              reserved for you until the checkout session expires.
            </p>
          </div>
          <div className="flex gap-2">
            {orderId ? (
              <Button asChild>
                <Link to={`/orders/${orderId}`}>Finish this order</Link>
              </Button>
            ) : null}
            <Button asChild variant="secondary">
              <Link to="/products">Back to the shop</Link>
            </Button>
          </div>
        </CardBody>
      </Card>
    </Container>
  );
}
