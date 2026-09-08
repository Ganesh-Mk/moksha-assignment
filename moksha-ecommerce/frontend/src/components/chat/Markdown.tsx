import { Fragment } from "react";

import { parseBlocks, type Span } from "@/lib/markdown";

/**
 * Renders the agent's replies.
 *
 * All the parsing is in `lib/markdown.ts`, which is where the reasoning for hand-rolling it lives
 * too. This file is the boring half on purpose: it turns parsed data into elements and never
 * touches `dangerouslySetInnerHTML`, so there is no injection surface to think about.
 */

function spans(items: Span[], keyPrefix: string) {
  return items.map((span, index) => {
    const key = `${keyPrefix}-${index}`;
    switch (span.kind) {
      case "strong":
        return (
          <strong key={key} className="font-semibold">
            {span.text}
          </strong>
        );
      case "em":
        return <em key={key}>{span.text}</em>;
      case "code":
        return (
          <code key={key} className="rounded bg-surface px-1 py-px font-mono text-[0.9em]">
            {span.text}
          </code>
        );
      default:
        return <Fragment key={key}>{span.text}</Fragment>;
    }
  });
}

export function Markdown({ text }: { text: string }) {
  return (
    <>
      {parseBlocks(text).map((block, index) => {
        if (block.kind === "paragraph") {
          return (
            <p key={index} className="[&+*]:mt-2">
              {spans(block.items[0] ?? [], `p${index}`)}
            </p>
          );
        }

        const List = block.kind === "bullets" ? "ul" : "ol";
        return (
          <List
            key={index}
            className={
              block.kind === "bullets"
                ? "ml-4 list-disc space-y-0.5 [&+*]:mt-2"
                : "ml-4 list-decimal space-y-0.5 [&+*]:mt-2"
            }
          >
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex} className="pl-0.5">
                {spans(item, `l${index}-${itemIndex}`)}
              </li>
            ))}
          </List>
        );
      })}
    </>
  );
}
