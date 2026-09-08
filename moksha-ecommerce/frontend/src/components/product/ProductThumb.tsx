import { ImageOff } from "lucide-react";

import { cn } from "@/lib/cn";

/**
 * A small product image, for order lines and the cart.
 *
 * One component rather than three near-identical blocks, because the details that make a
 * thumbnail behave are easy to get subtly different each time:
 *
 *   * **Explicit `width`/`height`.** The box reserves its space before the image decodes, so a
 *     list of orders does not reflow as each one arrives.
 *   * **`alt=""`.** The product name is always rendered next to the thumbnail, so announcing it
 *     twice is noise to a screen reader. An empty alt marks it decorative — which is different
 *     from omitting alt, and is the correct signal.
 *   * **A real empty state.** A missing image renders a muted placeholder rather than the
 *     browser's broken-image glyph.
 */
export function ProductThumb({
  src,
  size = 44,
  className,
}: {
  src: string | null;
  /** Rendered size in px. Kept a number so it can set width/height as well as the box. */
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-md",
        "border border-line bg-surface-sunken",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {src ? (
        <img
          src={src}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
        />
      ) : (
        <ImageOff className="size-4 text-ink-subtle" aria-hidden />
      )}
    </div>
  );
}

/**
 * Up to three thumbnails, overlapped, with a "+N" for the rest.
 *
 * Used on the orders list, where a row summarises a whole order. Showing only the first product's
 * image would misrepresent a five-item order as a one-item one; showing all of them would let a
 * large order set the row height. Three plus a count is the usual compromise, and it reads as
 * "several things" at a glance.
 */
export function ProductThumbStack({
  images,
  size = 44,
  max = 3,
}: {
  images: (string | null)[];
  size?: number;
  max?: number;
}) {
  const shown = images.slice(0, max);
  const remaining = images.length - shown.length;

  return (
    <div className="flex shrink-0 items-center">
      {shown.map((src, index) => (
        <ProductThumb
          key={index}
          src={src}
          size={size}
          // Overlap all but the first, and keep the stacking order left-over-right so the
          // leftmost image stays fully visible.
          className={cn(index > 0 && "-ml-3", "bg-surface")}
        />
      ))}
      {remaining > 0 ? (
        <span
          className={cn(
            "-ml-3 flex items-center justify-center rounded-md border border-line",
            "bg-surface-sunken text-2xs font-semibold tabular-nums text-ink-muted",
          )}
          style={{ width: size, height: size }}
        >
          +{remaining}
        </span>
      ) : null}
    </div>
  );
}
