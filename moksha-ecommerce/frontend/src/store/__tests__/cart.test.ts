import { beforeEach, describe, expect, it } from "vitest";

import { MAX_PER_LINE, selectItemCount, selectSubtotalCents, useCart } from "@/store/cart";
import type { CartProposal, Product } from "@/types/api";

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

describe("cart lines proposed by the support agent", () => {
  function proposal(overrides: Partial<CartProposal> = {}): CartProposal {
    return {
      product_id: 1,
      slug: "curl-defining-gel",
      name: "Curl Defining Gel",
      quantity: 2,
      unit_price_cents: 64900,
      currency: "INR",
      image_url: "/products/curl-defining-gel.svg",
      stock: 10,
      ...overrides,
    };
  }

  beforeEach(() => {
    useCart.getState().clear();
  });

  it("adds a proposed line to the same cart a button click fills", () => {
    useCart.getState().addProposal(proposal());

    const [line] = useCart.getState().lines;
    expect(line?.productId).toBe(1);
    expect(line?.quantity).toBe(2);
    expect(selectSubtotalCents(useCart.getState())).toBe(129800);
  });

  it("replaces rather than accumulates, because the server already merged", () => {
    // The agent's draft merges its own tool calls and clamps against live stock,
    // so its quantity is the total it means. Adding to what is here would double
    // an agent turn the customer simply asked it to repeat.
    useCart.getState().addProposal(proposal({ quantity: 2 }));
    useCart.getState().addProposal(proposal({ quantity: 3 }));

    expect(useCart.getState().lines).toHaveLength(1);
    expect(useCart.getState().lines[0]?.quantity).toBe(3);
  });

  it("still clamps to stock, even though the server did", () => {
    // Belt and braces on purpose: this payload crossed the network, and the
    // stepper's ceiling comes from the same field.
    useCart.getState().addProposal(proposal({ quantity: 99, stock: 4 }));

    expect(useCart.getState().lines[0]?.quantity).toBe(4);
  });

  it("never exceeds the per-line ceiling", () => {
    useCart.getState().addProposal(proposal({ quantity: 5000, stock: 100000 }));

    expect(useCart.getState().lines[0]?.quantity).toBe(MAX_PER_LINE);
  });

  it("leaves other lines alone", () => {
    useCart.getState().add(product({ id: 2, slug: "argan-hair-oil" }), 1);
    useCart.getState().addProposal(proposal());

    expect(useCart.getState().lines.map((l) => l.productId)).toEqual([2, 1]);
  });
});
