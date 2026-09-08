/**
 * Just enough Markdown for what the support agent actually writes.
 *
 * **Why not react-markdown.** It is ~45 kB gzipped with a remark pipeline, and it exists to
 * render arbitrary documents — tables, footnotes, HTML passthrough, autolinks. The agent's system
 * prompt asks for two or three sentences and the occasional list. Handling that subset is this
 * file, and it buys a property the library would cost extra to get: the parser emits plain data,
 * the renderer turns that data into React elements, and nothing anywhere calls
 * `dangerouslySetInnerHTML`. There is no HTML-injection surface to sanitise, which matters here
 * more than anywhere else in the app because this text is partly composed of product names an
 * admin typed.
 *
 * Parsing lives here, apart from the component, so it can be tested as the pure function it is —
 * no DOM, no render harness, and the cases that actually broke (a stray `**`, a wrapped
 * paragraph, a numbered list) are one assertion each.
 *
 * Handled: paragraphs, `- `/`* ` bullets, `1. ` ordered lists, `**bold**`, `*italic*`, `_italic_`
 * and `` `code` ``. Anything else stays literal, which is the right failure — showing a stray `#`
 * is better than swallowing the line it was on.
 */

const BULLET = /^\s*[-*]\s+/;
const ORDERED = /^\s*\d+[.)]\s+/;

/** Non-greedy on purpose, so `**a** and **b**` is two spans and not one enormous one. */
const INLINE = /(\*\*[^*]+\*\*|\*[^*\n]+\*|_[^_\n]+_|`[^`\n]+`)/g;

export type SpanKind = "text" | "strong" | "em" | "code";

export interface Span {
  kind: SpanKind;
  text: string;
}

export type BlockKind = "paragraph" | "bullets" | "numbers";

export interface Block {
  kind: BlockKind;
  /** One entry per paragraph or per list item, already split into spans. */
  items: Span[][];
}

export function parseInline(text: string): Span[] {
  const spans: Span[] = [];

  for (const piece of text.split(INLINE)) {
    if (!piece) continue;

    if (piece.length > 4 && piece.startsWith("**") && piece.endsWith("**")) {
      spans.push({ kind: "strong", text: piece.slice(2, -2) });
    } else if (piece.length > 2 && piece.startsWith("`") && piece.endsWith("`")) {
      spans.push({ kind: "code", text: piece.slice(1, -1) });
    } else if (
      piece.length > 2 &&
      ((piece.startsWith("*") && piece.endsWith("*")) ||
        (piece.startsWith("_") && piece.endsWith("_")))
    ) {
      spans.push({ kind: "em", text: piece.slice(1, -1) });
    } else {
      spans.push({ kind: "text", text: piece });
    }
  }

  return spans;
}

export function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  // Raw lines are kept alongside the blocks so consecutive list items and wrapped paragraph
  // lines can be merged before anything is split into spans.
  const raw: string[][] = [];

  for (const line of text.split("\n").map((l) => l.trimEnd())) {
    const kind: BlockKind = BULLET.test(line)
      ? "bullets"
      : ORDERED.test(line)
        ? "numbers"
        : "paragraph";
    const content =
      kind === "bullets"
        ? line.replace(BULLET, "")
        : kind === "numbers"
          ? line.replace(ORDERED, "")
          : line;

    const last = blocks.at(-1);
    const lastLines = raw.at(-1);

    if (kind !== "paragraph" && last?.kind === kind && lastLines) {
      lastLines.push(content);
    } else if (
      kind === "paragraph" &&
      last?.kind === "paragraph" &&
      lastLines &&
      content.trim() &&
      lastLines.at(-1)?.trim()
    ) {
      // A soft wrap inside one paragraph. Joined rather than kept as its own block: the model
      // wraps its prose, and rendering each wrapped line as a separate paragraph looks broken.
      lastLines.push(content);
    } else if (content.trim()) {
      blocks.push({ kind, items: [] });
      raw.push([content]);
    }
    // A blank line ends the current block by falling through: the next line starts a new one.
    else if (kind === "paragraph" && last) {
      blocks.push({ kind: "paragraph", items: [] });
      raw.push([]);
    }
  }

  return blocks
    .map((block, index) => ({
      kind: block.kind,
      items:
        block.kind === "paragraph"
          ? [parseInline((raw[index] ?? []).join(" "))]
          : (raw[index] ?? []).map(parseInline),
    }))
    .filter((block) => block.items.some((spans) => spans.length > 0));
}
