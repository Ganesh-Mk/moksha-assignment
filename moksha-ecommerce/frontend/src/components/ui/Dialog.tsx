import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Modal dialog and side sheet.
 *
 * Built on Radix — the same primitive shadcn/ui is built on — and then styled
 * entirely to our token set (DECISIONS D-013). The library is here for the
 * behaviour, which is genuinely hard to get right and invisible when wrong:
 * focus is trapped inside the dialog, focus returns to whatever opened it,
 * Escape closes, the page behind is inert to a screen reader, and body scroll
 * is locked without the layout shifting as the scrollbar disappears.
 *
 * The styling is ours. None of Radix's or shadcn's default look survives.
 */

export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;
export const DialogClose = RadixDialog.Close;

function Overlay() {
  return (
    <RadixDialog.Overlay
      className={cn(
        "fixed inset-0 z-40 bg-[rgb(26_25_23/0.35)] backdrop-blur-[2px]",
        "data-[state=open]:animate-[fade-in_var(--dur-base)_var(--ease-out)]",
      )}
    />
  );
}

export function DialogContent({
  title,
  description,
  children,
  footer,
  className,
}: {
  title: string;
  /** Optional, but if omitted Radix warns — so pass `undefined` deliberately, not by accident. */
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <RadixDialog.Portal>
      <Overlay />
      <RadixDialog.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md",
          "-translate-x-1/2 -translate-y-1/2",
          "rounded-xl border border-line bg-surface shadow-dialog",
          "focus:outline-none",
          "data-[state=open]:animate-[scale-in_var(--dur-base)_var(--ease-spring)]",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-4 py-3">
          <div>
            <RadixDialog.Title className="text-sm font-semibold text-ink">
              {title}
            </RadixDialog.Title>
            {description ? (
              <RadixDialog.Description className="mt-0.5 text-xs text-ink-muted">
                {description}
              </RadixDialog.Description>
            ) : null}
          </div>
          <RadixDialog.Close
            className={cn(
              "-mr-1 -mt-1 rounded-md p-1.5 text-ink-subtle",
              "transition-colors duration-[--dur-fast] hover:bg-surface-hover hover:text-ink",
            )}
          >
            <X className="size-4" aria-hidden />
            <span className="sr-only">Close</span>
          </RadixDialog.Close>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-4 py-4">{children}</div>

        {footer ? (
          <div className="flex justify-end gap-2 border-t border-line px-4 py-3">{footer}</div>
        ) : null}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}

/**
 * A panel that slides in from the right. Used for the cart.
 *
 * A sheet rather than a page, because the cart is a place you glance at and
 * leave — navigating away from the catalogue to check it, then back, loses your
 * scroll position and your place in the grid.
 */
export function SheetContent({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <RadixDialog.Portal>
      <Overlay />
      <RadixDialog.Content
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-[26rem] flex-col",
          "border-l border-line bg-surface shadow-dialog focus:outline-none",
          "data-[state=open]:animate-[slide-in-right_var(--dur-base)_var(--ease-out)]",
          "data-[state=closed]:animate-[slide-out-right_var(--dur-fast)_var(--ease-in-out)]",
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-4 py-3">
          <div>
            <RadixDialog.Title className="text-sm font-semibold text-ink">
              {title}
            </RadixDialog.Title>
            {description ? (
              <RadixDialog.Description className="mt-0.5 text-xs text-ink-muted">
                {description}
              </RadixDialog.Description>
            ) : null}
          </div>
          <RadixDialog.Close
            className={cn(
              "-mr-1 -mt-1 rounded-md p-1.5 text-ink-subtle",
              "transition-colors duration-[--dur-fast] hover:bg-surface-hover hover:text-ink",
            )}
          >
            <X className="size-4" aria-hidden />
            <span className="sr-only">Close</span>
          </RadixDialog.Close>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>

        {footer ? <div className="border-t border-line p-4">{footer}</div> : null}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}
