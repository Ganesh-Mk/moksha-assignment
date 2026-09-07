import * as RadixToast from "@radix-ui/react-toast";
import { AlertTriangle, Check, Info, X } from "lucide-react";
import { useCallback, useMemo, useState, type ReactNode } from "react";

import { ToastContext, type ToastApi, type ToastTone } from "@/components/ui/toastContext";
import { cn } from "@/lib/cn";

/**
 * Toasts.
 *
 * On Radix for the behaviour that matters and is invisible when absent: the
 * viewport is an ARIA live region, so a toast is announced rather than only
 * seen; the timer pauses when the window loses focus or the pointer is over the
 * toast, so a message cannot vanish while it is being read; and F6 jumps to it.
 *
 * Errors do not auto-dismiss. A success message can disappear — the thing it
 * describes already happened. An error usually names an action the person has
 * to take, and a message that vanishes before it is read is worse than none.
 */

interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
}

const ICONS: Record<ToastTone, typeof Check> = {
  success: Check,
  error: AlertTriangle,
  info: Info,
};

const TONE_STYLES: Record<ToastTone, string> = {
  success: "border-l-accent",
  error: "border-l-danger",
  info: "border-l-info",
};

const ICON_STYLES: Record<ToastTone, string> = {
  success: "text-accent",
  error: "text-danger",
  info: "text-info",
};

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((tone: ToastTone, title: string, description?: string) => {
    const id = nextId++;
    setItems((current) => [
      ...current,
      { id, tone, title, ...(description !== undefined ? { description } : {}) },
    ]);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (title, description) => push("success", title, description),
      error: (title, description) => push("error", title, description),
      info: (title, description) => push("info", title, description),
    }),
    [push],
  );

  return (
    <ToastContext value={api}>
      <RadixToast.Provider swipeDirection="right" duration={4500}>
        {children}

        {items.map((item) => {
          const Icon = ICONS[item.tone];
          return (
            <RadixToast.Root
              key={item.id}
              // Errors persist until dismissed; everything else fades.
              duration={item.tone === "error" ? Infinity : 4500}
              onOpenChange={(open) => {
                if (!open) setItems((current) => current.filter((t) => t.id !== item.id));
              }}
              className={cn(
                "flex items-start gap-2.5 rounded-lg border border-l-2 border-line bg-surface p-3",
                "shadow-overlay",
                "data-[state=open]:animate-[rise-in_var(--dur-base)_var(--ease-out)]",
                "data-[state=closed]:animate-[fade-in_var(--dur-fast)_reverse]",
                "data-[swipe=end]:animate-[slide-out-right_var(--dur-fast)_var(--ease-in-out)]",
                TONE_STYLES[item.tone],
              )}
            >
              <Icon className={cn("mt-px size-4 shrink-0", ICON_STYLES[item.tone])} aria-hidden />
              <div className="min-w-0 flex-1">
                <RadixToast.Title className="text-sm font-medium text-ink">
                  {item.title}
                </RadixToast.Title>
                {item.description ? (
                  <RadixToast.Description className="mt-0.5 text-xs text-ink-muted">
                    {item.description}
                  </RadixToast.Description>
                ) : null}
              </div>
              <RadixToast.Close
                className="rounded p-0.5 text-ink-subtle transition-colors hover:text-ink"
                aria-label="Dismiss"
              >
                <X className="size-3.5" aria-hidden />
              </RadixToast.Close>
            </RadixToast.Root>
          );
        })}

        <RadixToast.Viewport
          className={cn(
            "fixed bottom-0 right-0 z-[60] flex w-full max-w-sm flex-col gap-2 p-4",
            "outline-none",
          )}
        />
      </RadixToast.Provider>
    </ToastContext>
  );
}
