import { describe, expect, it } from "vitest";

import { ORDER_STATUS_LABEL, formatMoney, pluralise } from "@/lib/format";
import type { OrderStatus } from "@/types/api";

/**
 * Money formatting is the one place integer cents become a displayed amount.
 * A bug here is silent — the page renders, the number is just wrong — which is
 * exactly the kind of thing worth pinning down.
 */
describe("formatMoney", () => {
  it("renders whole rupees with two decimal places", () => {
    expect(formatMoney(49900)).toBe("₹499.00");
  });

  it("renders a fractional amount without rounding it away", () => {
    expect(formatMoney(49999)).toBe("₹499.99");
  });

  it("renders zero rather than an empty string", () => {
    expect(formatMoney(0)).toBe("₹0.00");
  });

  it("groups thousands in the Indian convention", () => {
    // en-IN groups as 1,29,900 rather than 129,900. Worth asserting: it is a
    // real difference an Indian reviewer would notice immediately.
    expect(formatMoney(12990000)).toBe("₹1,29,900.00");
  });

  it("handles a large amount without switching to exponent notation", () => {
    expect(formatMoney(100000000)).toBe("₹10,00,000.00");
  });

  it("respects a different currency", () => {
    expect(formatMoney(1999, "USD")).toBe("$19.99");
  });

  it("never loses a cent to floating point", () => {
    // 0.1 + 0.2 !== 0.3 in binary floating point. This is the reason money is
    // an integer everywhere in this codebase — the division happens once, here.
    expect(formatMoney(10 + 20)).toBe("₹0.30");
    expect(formatMoney(2999 * 3)).toBe("₹89.97");
  });
});

describe("ORDER_STATUS_LABEL", () => {
  it("has a human label for every status the API can return", () => {
    // A missing entry renders as `undefined` in a badge rather than throwing,
    // so the failure would ship silently.
    const statuses: OrderStatus[] = [
      "pending_payment",
      "paid",
      "fulfilled",
      "payment_failed",
      "cancelled",
    ];
    for (const status of statuses) {
      expect(ORDER_STATUS_LABEL[status]).toBeTruthy();
    }
  });
});

describe("pluralise", () => {
  it.each([
    [0, "0 items"],
    [1, "1 item"],
    [2, "2 items"],
  ])("formats %i as %s", (count, expected) => {
    expect(pluralise(count, "item")).toBe(expected);
  });
});
