import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { CartProposal, Product } from "@/types/api";

/**
 * The cart — the only genuinely client-owned state in this application
 * (DECISIONS D-012). Everything else is server data living in the TanStack
 * Query cache.
 *
 * **What is stored, and what is not.** A line keeps the product id, quantity,
 * and a display snapshot (name, image, price at the time it was added). The
 * snapshot exists purely so the cart can render without refetching every
 * product; it is *never* sent to the server and never used to compute a total
 * the user is charged. The order endpoint accepts product ids and quantities
 * only — there is no field for a price — and recomputes everything from the
 * database.
 *
 * That distinction is the whole point: a cart persisted in localStorage is
 * attacker-editable, and any design where editing it changes what you pay is
 * broken. Here, editing it changes what the user *sees* until the server
 * corrects them at checkout.
 */

export interface CartLine {
  productId: number;
  slug: string;
  quantity: number;
  /** Display-only snapshot. See the note above. */
  name: string;
  priceCents: number;
  currency: string;
  imageUrl: string | null;
  /** Last-known stock, for the quantity stepper's ceiling. Advisory, not enforcement. */
  stock: number;
}

interface CartState {
  lines: CartLine[];
  add: (product: Product, quantity?: number) => void;
  /**
   * Apply a line the support agent proposed.
   *
   * A separate action rather than reusing `add`, because a proposal is not a
   * `Product` — it is a narrower payload the server assembled, and widening
   * `add` to accept either would mean every caller proving which it has. The
   * merge rule is identical, and for the identical reason.
   */
  addProposal: (proposal: CartProposal) => void;
  setQuantity: (productId: number, quantity: number) => void;
  remove: (productId: number) => void;
  clear: () => void;
}

export const MAX_PER_LINE = 99;

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],

      add: (product, quantity = 1) =>
        set((state) => {
          const existing = state.lines.find((line) => line.productId === product.id);

          if (existing) {
            // Merge rather than append. The server enforces one line per
            // product per order — and more importantly its stock lock takes one
            // lock per product, so two unmerged lines would each be checked
            // against the full stock and together could oversell it.
            return {
              lines: state.lines.map((line) =>
                line.productId === product.id
                  ? {
                      ...line,
                      quantity: Math.min(line.quantity + quantity, product.stock, MAX_PER_LINE),
                    }
                  : line,
              ),
            };
          }

          return {
            lines: [
              ...state.lines,
              {
                productId: product.id,
                slug: product.slug,
                quantity: Math.min(quantity, product.stock, MAX_PER_LINE),
                name: product.name,
                priceCents: product.price_cents,
                currency: product.currency,
                imageUrl: product.image_url,
                stock: product.stock,
              },
            ],
          };
        }),

      addProposal: (proposal) =>
        set((state) => {
          const existing = state.lines.find((line) => line.productId === proposal.product_id);
          const line: CartLine = {
            productId: proposal.product_id,
            slug: proposal.slug,
            // The server already merged and clamped against live stock, so its
            // quantity replaces rather than adds to what is here. Adding would
            // double an agent turn the user asked to repeat.
            quantity: Math.min(proposal.quantity, proposal.stock, MAX_PER_LINE),
            name: proposal.name,
            priceCents: proposal.unit_price_cents,
            currency: proposal.currency,
            imageUrl: proposal.image_url,
            stock: proposal.stock,
          };
          return {
            lines: existing
              ? state.lines.map((l) => (l.productId === proposal.product_id ? line : l))
              : [...state.lines, line],
          };
        }),

      setQuantity: (productId, quantity) =>
        set((state) => ({
          // Setting a quantity to zero removes the line. Leaving a zero-quantity
          // line would send an item the server rejects with a validation error
          // for something the user thought they had deleted.
          lines:
            quantity <= 0
              ? state.lines.filter((line) => line.productId !== productId)
              : state.lines.map((line) =>
                  line.productId === productId
                    ? { ...line, quantity: Math.min(quantity, MAX_PER_LINE) }
                    : line,
                ),
        })),

      remove: (productId) =>
        set((state) => ({ lines: state.lines.filter((line) => line.productId !== productId) })),

      clear: () => set({ lines: [] }),
    }),
    {
      name: "moksha.cart",
      version: 1,
      // Only `lines` is persisted; the actions are recreated on load.
      partialize: (state) => ({ lines: state.lines }),
    },
  ),
);

/**
 * Selectors as functions rather than derived state in the store.
 *
 * `useCart((s) => s.lines.reduce(...))` inside a component would return a new
 * value identity on every render for object results and re-render constantly.
 * These return primitives, which compare by value.
 */
export const selectItemCount = (state: CartState): number =>
  state.lines.reduce((total, line) => total + line.quantity, 0);

export const selectSubtotalCents = (state: CartState): number =>
  state.lines.reduce((total, line) => total + line.priceCents * line.quantity, 0);
