import { beforeEach, describe, expect, it } from "vitest";

import { MAX_PER_LINE, selectItemCount, selectSubtotalCents, useCart } from "@/store/cart";
import type { Product } from "@/types/api";

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: 1,
    name: "Curl Defining Gel",
    slug: "curl-defining-gel",
    description: "",
    price_cents: 64900,
    currency: "INR",
    image_url: null,
    category: "style",
    stock: 10,
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("cart", () => {
  beforeEach(() => {
    useCart.getState().clear();
  });

  it("adds a product", () => {
    useCart.getState().add(product());

    expect(useCart.getState().lines).toHaveLength(1);
    expect(selectItemCount(useCart.getState())).toBe(1);
  });

  it("merges a repeat add into one line rather than appending a second", () => {
    // Not cosmetic. The server enforces one line per product per order, and its
    // stock lock takes one lock per product — two lines for the same product
    // would each be validated against the full stock and could oversell it.
    useCart.getState().add(product(), 2);
    useCart.getState().add(product(), 3);

    expect(useCart.getState().lines).toHaveLength(1);
    expect(useCart.getState().lines[0]?.quantity).toBe(5);
  });

  it("never lets a line exceed the product's stock", () => {
    useCart.getState().add(product({ stock: 3 }), 10);

    expect(useCart.getState().lines[0]?.quantity).toBe(3);
  });

  it("never lets a line exceed the per-line maximum", () => {
    useCart.getState().add(product({ stock: 10_000 }), 500);

    expect(useCart.getState().lines[0]?.quantity).toBe(MAX_PER_LINE);
  });

  it("removes the line when its quantity reaches zero", () => {
    // A zero-quantity line would be sent to the server and rejected as a
    // validation error for something the user thought they had deleted.
    useCart.getState().add(product());
    useCart.getState().setQuantity(1, 0);

    expect(useCart.getState().lines).toEqual([]);
  });

  it("removes the line for a negative quantity too", () => {
    useCart.getState().add(product());
    useCart.getState().setQuantity(1, -5);

    expect(useCart.getState().lines).toEqual([]);
  });

  it("sums the subtotal from integer cents", () => {
    useCart.getState().add(product({ id: 1, slug: "a", price_cents: 49900 }), 2);
    useCart.getState().add(product({ id: 2, slug: "b", price_cents: 54900 }), 1);

    expect(selectSubtotalCents(useCart.getState())).toBe(49900 * 2 + 54900);
    expect(selectItemCount(useCart.getState())).toBe(3);
  });

  it("keeps a price snapshot that is display-only", () => {
    // The snapshot exists so the cart can render without refetching. It is
    // never sent: the order request carries product ids and quantities only,
    // and the server recomputes the total from its own rows.
    useCart.getState().add(product({ price_cents: 64900 }));

    const line = useCart.getState().lines[0];
    expect(line?.priceCents).toBe(64900);
    expect(line?.productId).toBe(1);
  });

  it("clears completely", () => {
    useCart.getState().add(product({ id: 1, slug: "a" }));
    useCart.getState().add(product({ id: 2, slug: "b" }));
    useCart.getState().clear();

    expect(useCart.getState().lines).toEqual([]);
    expect(selectSubtotalCents(useCart.getState())).toBe(0);
  });
});
