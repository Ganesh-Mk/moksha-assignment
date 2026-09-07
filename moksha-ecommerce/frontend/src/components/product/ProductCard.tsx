import { Check, Plus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import { useCart } from "@/store/cart";
import type { Product } from "@/types/api";

/**
 * One product in the grid.
 *
 * Design notes worth defending:
 *
 *   * The whole card is a link, but the add button is not nested inside it —
 *     a button inside an anchor is invalid HTML and behaves unpredictably. The
 *     link covers the card via an absolutely-positioned overlay instead, and
 *     the button sits above it in the stacking order.
 *   * The image has explicit width/height. Without them the grid reflows as
 *     each image decodes, which is exactly the layout shift Lighthouse scores
 *     against and which feels like the page fighting you.
 *   * Hover lifts the image, not the card. Moving the whole card nudges its
 *     neighbours' perceived alignment; scaling the image inside a fixed frame
 *     does not move anything.
 */
export function ProductCard({ product }: { product: Product }) {
  const add = useCart((state) => state.add);
  const [justAdded, setJustAdded] = useState(false);
  const soldOut = product.stock <= 0;

  function handleAdd() {
    add(product);
    setJustAdded(true);
    // A brief confirmation on the button itself. The cart badge also animates,
    // but that is in the corner of the screen and easy to miss.
    window.setTimeout(() => setJustAdded(false), 1400);
  }

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-lg border border-line bg-surface",
        "transition-[border-color,box-shadow] duration-[--dur-base] ease-out",
        "hover:border-line-strong hover:shadow-raised",
        "focus-within:border-accent",
      )}
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-surface-sunken">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            width={400}
            height={500}
            loading="lazy"
            decoding="async"
            className={cn(
              "size-full object-cover",
              "transition-transform duration-[--dur-slow] ease-out group-hover:scale-[1.04]",
              soldOut && "opacity-55 grayscale",
            )}
          />
        ) : (
          <div className="flex size-full items-center justify-center text-xs text-ink-subtle">
            No image
          </div>
        )}

        {soldOut ? (
          <span className="absolute left-2 top-2 rounded-full bg-surface/95 px-2 py-0.5 text-2xs font-semibold uppercase tracking-[--tracking-label] text-ink-muted">
            Sold out
          </span>
        ) : product.stock <= 5 ? (
          <span className="absolute left-2 top-2 rounded-full bg-warning-soft px-2 py-0.5 text-2xs font-semibold uppercase tracking-[--tracking-label] text-warning-soft-ink">
            Only {product.stock} left
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="label-caps">{product.category}</p>

        <h3 className="text-sm font-medium leading-snug text-ink">
          {/* The overlay link. `after:` covers the card so the entire tile is
              clickable while the accessible name stays just the product name. */}
          <Link
            to={`/products/${product.slug}`}
            className="rounded-sm after:absolute after:inset-0 after:content-['']"
          >
            {product.name}
          </Link>
        </h3>

        <p className="line-clamp-2 text-xs leading-snug text-ink-muted">{product.description}</p>

        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <span className="tnum text-sm font-semibold text-ink">
            {formatMoney(product.price_cents, product.currency)}
          </span>

          <button
            type="button"
            onClick={handleAdd}
            disabled={soldOut}
            className={cn(
              // z-10 lifts it above the link overlay; without it the card link
              // swallows the click and the button silently does nothing.
              "relative z-10 flex size-7 items-center justify-center rounded-md border",
              "transition-[background-color,border-color,color] duration-[--dur-fast]",
              justAdded
                ? "border-accent bg-accent text-accent-ink"
                : "border-line-strong bg-surface text-ink-muted hover:border-accent hover:bg-accent hover:text-accent-ink",
              "disabled:pointer-events-none disabled:opacity-40",
            )}
          >
            {justAdded ? (
              <Check className="size-3.5" aria-hidden />
            ) : (
              <Plus className="size-3.5" aria-hidden />
            )}
            <span className="sr-only">
              {soldOut ? `${product.name} is sold out` : `Add ${product.name} to cart`}
            </span>
          </button>
        </div>
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      <div className="aspect-[4/5] animate-[shimmer_1.4s_linear_infinite] bg-surface-sunken bg-[linear-gradient(110deg,transparent_30%,var(--surface-hover)_50%,transparent_70%)] bg-[length:200%_100%]" />
      <div className="flex flex-col gap-2 p-3">
        <div className="h-2 w-12 rounded bg-surface-sunken" />
        <div className="h-3 w-3/4 rounded bg-surface-sunken" />
        <div className="h-2 w-full rounded bg-surface-sunken" />
        <div className="mt-2 h-3 w-16 rounded bg-surface-sunken" />
      </div>
    </div>
  );
}
