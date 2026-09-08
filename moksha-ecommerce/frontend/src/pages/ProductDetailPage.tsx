import { ArrowLeft, Check, Minus, PackageSearch, Plus, ShoppingBag } from "lucide-react";
import { useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { Container } from "@/components/layout/Container";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useProduct } from "@/hooks/useProducts";
import { cn } from "@/lib/cn";
import { flyToCart } from "@/lib/flyToCart";
import { formatMoney } from "@/lib/format";
import { MAX_PER_LINE, useCart } from "@/store/cart";

export function ProductDetailPage() {
  const { slug = "" } = useParams();
  const { data: product, isPending, isError } = useProduct(slug);
  const add = useCart((state) => state.add);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const image = useRef<HTMLImageElement>(null);

  if (isPending) {
    return (
      <Container className="py-8">
        <div className="grid gap-8 md:grid-cols-2">
          <Skeleton className="aspect-square rounded-lg" />
          <div className="flex flex-col gap-3 pt-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-3/4" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-10 w-40" />
          </div>
        </div>
      </Container>
    );
  }

  if (isError || !product) {
    return (
      <Container className="py-8">
        <EmptyState
          icon={PackageSearch}
          title="Product not found"
          description="It may have been withdrawn from the range."
          action={
            <Button asChild variant="secondary" size="sm">
              <Link to="/products">Back to the shop</Link>
            </Button>
          }
        />
      </Container>
    );
  }

  const soldOut = product.stock <= 0;
  const max = Math.min(product.stock, MAX_PER_LINE);

  function handleAdd() {
    if (!product) return;
    add(product, quantity);
    setAdded(true);
    flyToCart(image.current, product.image_url);
    window.setTimeout(() => setAdded(false), 1800);
  }

  return (
    <Container className="py-6 sm:py-8">
      <Link
        to="/products"
        className="mb-5 inline-flex items-center gap-1.5 rounded-sm text-xs text-ink-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Back to the shop
      </Link>

      <div className="grid gap-6 md:grid-cols-2 md:gap-10">
        {/* Padded and `object-contain`, for the same reason as the grid card:
            the hero was cropping the top and bottom off a tall bottle. */}
        <div className="overflow-hidden rounded-lg border border-line bg-surface-sunken p-6 sm:p-10">
          {product.image_url ? (
            <img
              ref={image}
              src={product.image_url}
              alt={product.name}
              width={720}
              height={720}
              // The hero image is the LCP element on this page: eager, high
              // priority, no lazy attribute. Lazy-loading it would delay the
              // exact thing the metric measures.
              loading="eager"
              fetchPriority="high"
              decoding="async"
              className="aspect-square w-full object-contain"
            />
          ) : (
            <div className="flex aspect-square items-center justify-center text-sm text-ink-subtle">
              No image
            </div>
          )}
        </div>

        <div className="flex flex-col">
          <p className="label-caps">{product.category}</p>
          <h1 className="mt-1.5 font-display text-3xl leading-tight text-ink">{product.name}</h1>

          <div className="mt-3 flex items-center gap-3">
            <span className="tnum text-xl font-semibold text-ink">
              {formatMoney(product.price_cents, product.currency)}
            </span>
            {soldOut ? (
              <Badge tone="neutral">Sold out</Badge>
            ) : product.stock <= 5 ? (
              <Badge tone="warning">Only {product.stock} left</Badge>
            ) : (
              <Badge tone="accent">In stock</Badge>
            )}
          </div>

          <p className="mt-4 max-w-prose text-sm leading-relaxed text-ink-muted">
            {product.description}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-5">
            {/* h-11 to match the lg button beside it. Two adjacent controls
                at different heights is the sort of thing you cannot un-see. */}
            <div
              className="flex h-11 items-center rounded-md border border-line-strong"
              role="group"
              aria-label="Quantity"
            >
              <StepperButton
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1 || soldOut}
                label="Decrease quantity"
              >
                <Minus className="size-3.5" aria-hidden />
              </StepperButton>
              <span
                className="w-8 text-center text-sm tabular-nums text-ink"
                aria-live="polite"
                aria-atomic
              >
                {quantity}
              </span>
              <StepperButton
                onClick={() => setQuantity((q) => Math.min(max, q + 1))}
                disabled={quantity >= max || soldOut}
                label="Increase quantity"
              >
                <Plus className="size-3.5" aria-hidden />
              </StepperButton>
            </div>

            <Button
              size="lg"
              onClick={handleAdd}
              disabled={soldOut}
              icon={
                added ? <Check className="size-4" aria-hidden /> : <ShoppingBag className="size-4" aria-hidden />
              }
            >
              {soldOut ? "Sold out" : added ? "Added to cart" : "Add to cart"}
            </Button>
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-line pt-5 text-xs">
            <Detail label="Delivery">2–4 working days</Detail>
            <Detail label="Returns">30 days, unopened</Detail>
            <Detail label="Category" className="capitalize">
              {product.category}
            </Detail>
            <Detail label="Reference">{product.slug}</Detail>
          </dl>
        </div>
      </div>
    </Container>
  );
}

function StepperButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-full w-10 items-center justify-center text-ink-muted",
        "transition-colors duration-[--dur-fast] hover:text-ink",
        "disabled:pointer-events-none disabled:opacity-35",
      )}
    >
      {children}
      <span className="sr-only">{label}</span>
    </button>
  );
}

function Detail({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div>
      <dt className="label-caps">{label}</dt>
      <dd className={cn("mt-0.5 text-ink-muted", className)}>{children}</dd>
    </div>
  );
}
