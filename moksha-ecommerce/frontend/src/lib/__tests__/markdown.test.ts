import { describe, expect, it } from "vitest";

import { parseBlocks, parseInline } from "@/lib/markdown";

/** Flatten a block's spans back to plain text, for asserting on structure without the markers. */
const flat = (spans: { text: string }[]) => spans.map((s) => s.text).join("");

describe("parseInline", () => {
  it("turns **bold** into a span and drops the asterisks", () => {
    // The bug this file exists for: the agent's `**Curl Refresh Mist**` rendered with the
    // asterisks visible, because the bubble was printing raw text.
    expect(parseInline("We have **Curl Refresh Mist** in stock")).toEqual([
      { kind: "text", text: "We have " },
      { kind: "strong", text: "Curl Refresh Mist" },
      { kind: "text", text: " in stock" },
    ]);
  });

  it("handles two bold runs in one line without swallowing the middle", () => {
    expect(parseInline("**one** and **two**").filter((s) => s.kind === "strong")).toEqual([
      { kind: "strong", text: "one" },
      { kind: "strong", text: "two" },
    ]);
  });

  it("reads italics with either marker, and code", () => {
    expect(parseInline("*a* _b_ `c`").filter((s) => s.kind !== "text")).toEqual([
      { kind: "em", text: "a" },
      { kind: "em", text: "b" },
      { kind: "code", text: "c" },
    ]);
  });

  it("leaves an unmatched marker alone rather than eating the rest of the line", () => {
    expect(parseInline("2 ** 3 is not bold")).toEqual([{ kind: "text", text: "2 ** 3 is not bold" }]);
  });

  it("keeps prices and punctuation untouched", () => {
    expect(flat(parseInline("₹429.00 — 82 in stock"))).toBe("₹429.00 — 82 in stock");
  });
});

describe("parseBlocks", () => {
  it("groups a numbered list into one block", () => {
    const blocks = parseBlocks("We have three:\n\n1. Mist\n2. Cream\n3. Gel");

    expect(blocks.map((b) => b.kind)).toEqual(["paragraph", "numbers"]);
    expect(blocks[1]?.items.map(flat)).toEqual(["Mist", "Cream", "Gel"]);
  });

  it.each(["-", "*"])("groups bullets written with %s into one list", (marker) => {
    const [list] = parseBlocks(`${marker} one\n${marker} two`);

    expect(list?.kind).toBe("bullets");
    expect(list?.items.map(flat)).toEqual(["one", "two"]);
  });

  it("parses inline markers inside list items", () => {
    const [list] = parseBlocks("1. **Curl Refresh Mist** — ₹429.00");

    expect(list?.items[0]?.[0]).toEqual({ kind: "strong", text: "Curl Refresh Mist" });
  });

  it("joins a wrapped paragraph into one block", () => {
    // The model wraps its prose. Rendering each wrapped line as its own paragraph looks broken.
    const blocks = parseBlocks("All are in stock, though the\nCurl Defining Gel is running low.");

    expect(blocks).toHaveLength(1);
    expect(flat(blocks[0]?.items[0] ?? [])).toBe(
      "All are in stock, though the Curl Defining Gel is running low.",
    );
  });

  it("keeps a blank line as a paragraph boundary", () => {
    expect(parseBlocks("First.\n\nSecond.").map((b) => flat(b.items[0] ?? []))).toEqual([
      "First.",
      "Second.",
    ]);
  });

  it("returns nothing for empty or whitespace-only text", () => {
    expect(parseBlocks("")).toEqual([]);
    expect(parseBlocks("   \n  \n")).toEqual([]);
  });

  it("survives a mixed reply end to end", () => {
    const reply = [
      "We have three style products:",
      "",
      "1. **Curl Refresh Mist** — ₹429.00 (82 in stock)",
      "2. **Lightweight Leave-In Cream** — ₹599.00 (78 in stock)",
      "",
      "All are in stock, though the Curl Defining Gel is running low.",
    ].join("\n");

    const blocks = parseBlocks(reply);

    expect(blocks.map((b) => b.kind)).toEqual(["paragraph", "numbers", "paragraph"]);
    expect(blocks[1]?.items).toHaveLength(2);
    // No asterisk survives anywhere in the output.
    expect(blocks.flatMap((b) => b.items.flat()).every((s) => !s.text.includes("**"))).toBe(true);
  });
});
