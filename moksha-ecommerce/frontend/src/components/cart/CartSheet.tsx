import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Dialog, SheetContent } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/toastContext";
import { useAuth } from "@/hooks/authContext";
import { useCheckout, useCreateOrder } from "@/hooks/useOrders";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatMoney, pluralise } from "@/lib/format";
import { MAX_PER_LINE, selectItemCount, selectSubtotalCents, useCart } from "@/store/cart";

/**
 * The cart, and the whole checkout hand-off.
 *
 * The sequence is deliberate and worth stating, because it is where a checkout
 * usually goes wrong:
 *
 *   1. `POST /orders` — the server recomputes the total from database prices
 *      and reserves stock under a row lock. The cart's prices are display-only
 *      and are not sent.
 *   2. `POST /payments/create-checkout-session` — Stripe's session is built
 *      from the order that now exists in our database, not from the cart.
 *   3. Redirect to Stripe.
 *
 * The cart is cleared at step 3, not at step 1: if session creation fails, the
 * user still has their cart and the pending order can be paid from the orders
 * page. Clearing early would leave them with nothing and an invisible order.
 *
 * The subtotal shown here is a *preview*. The line under it says so, because
 * the server's figure is the one that is charged and quietly differing from it
 * would be worse than admitting the difference.
 */
export function CartSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const lines = useCart((state) => state.lines);
  const itemCount = useCart(selectItemCount);
  const subtotal = useCart(selectSubtotalCents);
  const setQuantity = useCart((state) => state.setQuantity);
  const remove = useCart((state) => state.remove);
  const clear = useCart((state) => state.clear);

  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const createOrder = useCreateOrder();
  const checkout = useCheckout();
  const [busy, setBusy] = useState(false);

  const currency = lines[0]?.currency ?? "INR";

  async function handleCheckout() {
    if (!user) {
      onOpenChange(false);
      navigate("/login", { state: { from: { pathname: "/products" } } });
      return;
    }

    setBusy(true);
    try {
      const order = await createOrder.mutateAsync(
        lines.map((line) => ({ product_id: line.productId, quantity: line.quantity })),
      );

      const session = await checkout.mutateAsync(order.id);

      clear();
      onOpenChange(false);
      // A full navigation, not react-router: Stripe Checkout is a different
      // origin and is not part of this SPA.
      window.location.href = session.checkout_url;
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.code === "insufficient_stock") {
          const available = error.details?.["available"];
          toast.error(
            "Not enough stock",
            `${error.message}${typeof available === "number" ? "" : ""} Adjust the quantity and try again.`,
          );
        } else if (error.isUnconfigured) {
          toast.error("Payments are not configured", "This deployment is missing its Stripe keys.");
        } else {
          toast.error("Checkout failed", error.message);
        }
      } else {
        toast.error("Checkout failed", "Something went wrong. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SheetContent
        title="Your cart"
        description={itemCount > 0 ? pluralise(itemCount, "item") : "Nothing here yet"}
        footer={
          lines.length > 0 ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-ink-muted">Subtotal</span>
                <span className="tnum text-lg font-semibold text-ink">
                  {formatMoney(subtotal, currency)}
                </span>
              </div>
              <p className="text-2xs leading-snug text-ink-subtle">
                A preview. The final total is recomputed from live prices when the order is
                placed — the server never trusts an amount sent by the browser.
              </p>
              <Button size="lg" onClick={() => void handleCheckout()} loading={busy}>
                {user ? "Checkout" : "Sign in to checkout"}
              </Button>
            </div>
          ) : null
        }
      >
        {lines.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title="Your cart is empty"
            description="Add something from the range and it will show up here."
          />
        ) : (
          <ul className="divide-y divide-line">
            {lines.map((line) => (
              <li key={line.productId} className="flex gap-3 p-4">
                <div className="size-14 shrink-0 overflow-hidden rounded-md border border-line bg-surface-sunken">
                  {line.imageUrl ? (
                    <img
                      src={line.imageUrl}
                      alt=""
                      width={56}
                      height={56}
                      loading="lazy"
                      className="size-full object-cover"
                    />
                  ) : null}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{line.name}</p>
                  <p className="tnum mt-0.5 text-xs text-ink-muted">
                    {formatMoney(line.priceCents, line.currency)} each
                  </p>

                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex h-7 items-center rounded-md border border-line-strong">
                      <QuantityButton
                        onClick={() => setQuantity(line.productId, line.quantity - 1)}
                        label={`Decrease quantity of ${line.name}`}
                      >
                        <Minus className="size-3" aria-hidden />
                      </QuantityButton>
                      <span className="w-7 text-center text-xs tabular-nums text-ink">
                        {line.quantity}
                      </span>
                      <QuantityButton
                        onClick={() => setQuantity(line.productId, line.quantity + 1)}
                        disabled={line.quantity >= Math.min(line.stock, MAX_PER_LINE)}
                        label={`Increase quantity of ${line.name}`}
                      >
                        <Plus className="size-3" aria-hidden />
                      </QuantityButton>
                    </div>

                    <button
                      type="button"
                      onClick={() => remove(line.productId)}
                      className="rounded p-1 text-ink-subtle transition-colors hover:text-danger"
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                      <span className="sr-only">Remove {line.name}</span>
                    </button>
                  </div>
                </div>

                <span className="tnum shrink-0 text-sm font-medium text-ink">
                  {formatMoney(line.priceCents * line.quantity, line.currency)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SheetContent>
    </Dialog>
  );
}

function QuantityButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-full w-6 items-center justify-center text-ink-muted",
        "transition-colors duration-[--dur-fast] hover:text-ink",
        "disabled:pointer-events-none disabled:opacity-35",
      )}
    >
      {children}
      <span className="sr-only">{label}</span>
    </button>
  );
}
