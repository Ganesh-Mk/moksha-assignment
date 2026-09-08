import { AlertTriangle, Bot, MessageCircle, Send, ShoppingBag, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Markdown } from "@/components/chat/Markdown";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/authContext";
import { useChat, type ChatMessage } from "@/hooks/useChat";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";

/**
 * The support agent, as a launcher and a panel.
 *
 * Deliberately not a full page: a customer asking "is this in stock?" wants the
 * answer *next to* the product, not on a screen that replaced it.
 *
 * Only rendered for signed-in users, because the endpoint requires
 * authentication — an agent that scopes answers to the caller has no meaningful
 * anonymous mode.
 */

const SUGGESTIONS = [
  "What products do you have?",
  "How much is the curl gel?",
  "Add the curl gel to my cart",
  "Where is my order?",
];

export function ChatWidget({ onOpenCart }: { onOpenCart: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const { messages, isStreaming, send } = useChat();

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Follow the stream. `scrollTop = scrollHeight` rather than scrollIntoView,
  // which would also scroll the page behind the panel.
  useEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Escape closes the panel. Not a Radix dialog: this is a non-modal companion,
  // so the page behind stays interactive and focus is not trapped.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!user) return null;

  function submit(text: string) {
    setDraft("");
    void send(text);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "fixed bottom-4 right-4 z-40 flex size-11 items-center justify-center rounded-full",
          "bg-accent text-accent-ink shadow-overlay",
          "transition-transform duration-[--dur-base] ease-spring",
          "hover:scale-105 active:scale-95",
        )}
        aria-expanded={open}
        aria-controls="support-agent"
      >
        {open ? <X className="size-4.5" aria-hidden /> : <MessageCircle className="size-4.5" aria-hidden />}
        <span className="sr-only">{open ? "Close the assistant" : "Ask the assistant"}</span>
      </button>

      {open ? (
        <section
          id="support-agent"
          aria-label="Support assistant"
          className={cn(
            "fixed bottom-[4.25rem] right-4 z-40 flex w-[calc(100vw-2rem)] max-w-88 flex-col",
            "h-[26rem] max-h-[70vh] overflow-hidden rounded-xl border border-line bg-surface",
            "shadow-dialog animate-[rise-in_var(--dur-base)_var(--ease-out)]",
          )}
        >
          <header className="flex items-center gap-2 border-b border-line px-3 py-2.5">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
              <Bot className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">Assistant</p>
              <p className="text-2xs text-ink-subtle">Answers from live store data</p>
            </div>
          </header>

          <div
            ref={scrollRef}
            className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-3"
            // A polite live region: new assistant text is announced without
            // interrupting whatever the screen reader is already saying.
            aria-live="polite"
          >
            {messages.length === 0 ? (
              <div className="flex flex-1 flex-col justify-end gap-2">
                <p className="text-xs leading-snug text-ink-muted">
                  I can look up prices, stock and your own orders, and put things in your cart. I
                  read the live database rather than guessing — but you pay from the cart yourself.
                </p>
                <div className="flex flex-col gap-1.5">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => submit(suggestion)}
                      className={cn(
                        "rounded-md border border-line bg-surface-sunken px-2.5 py-1.5 text-left",
                        "text-xs text-ink-muted transition-colors duration-[--dur-fast]",
                        "hover:border-line-strong hover:text-ink",
                      )}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex max-w-[88%] flex-col gap-2",
                    "animate-[rise-in_var(--dur-fast)_var(--ease-out)]",
                    message.role === "user" ? "items-end self-end" : "items-start self-start",
                  )}
                >
                  <div
                    className={cn(
                      "rounded-lg px-2.5 py-1.5 text-xs leading-relaxed",
                      message.role === "user"
                        ? "bg-accent text-accent-ink"
                        : "border border-line bg-surface-sunken text-ink",
                    )}
                  >
                    {message.error ? (
                      <span className="flex items-start gap-1.5 text-danger">
                        <AlertTriangle className="mt-px size-3 shrink-0" aria-hidden />
                        {message.error}
                      </span>
                    ) : message.content ? (
                      <Markdown text={message.content} />
                    ) : (
                      // Nothing has arrived yet — the model is reading the
                      // database. Three dots say "working" where an empty
                      // bubble says "broken".
                      <TypingDots />
                    )}
                  </div>

                  {message.cart?.length ? (
                    <CartHandoff lines={message.cart} onOpenCart={onOpenCart} />
                  ) : null}
                </div>
              ))
            )}
          </div>

          <form
            className="flex items-center gap-2 border-t border-line p-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (draft.trim()) submit(draft);
            }}
          >
            <input
              ref={inputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask about a product or an order…"
              maxLength={2000}
              className={cn(
                "h-8 min-w-0 flex-1 rounded-md border border-line-strong bg-surface px-2.5 text-xs",
                "text-ink placeholder:text-ink-subtle",
                "focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-ring)] focus:outline-none",
              )}
            />
            <Button type="submit" size="icon" className="size-8" disabled={!draft.trim() || isStreaming}>
              <Send className="size-3.5" aria-hidden />
              <span className="sr-only">Send</span>
            </Button>
          </form>
        </section>
      ) : null}
    </>
  );
}

/**
 * The "still thinking" indicator.
 *
 * Three dots on a staggered loop rather than a spinner: a spinner says "the
 * page is loading", these say "someone is composing a reply", which is the
 * truthful one while the agent is querying the database. The delays are
 * negative so the animation starts mid-cycle and the dots are never in step.
 *
 * The duration is a literal rather than a `--dur-*` token because the
 * reduced-motion block collapses those to nothing — correctly, for transitions.
 * Here the global `animation-duration: 0.01ms !important` already stops this
 * one, and the `sr-only` text carries the same meaning with no motion at all.
 */
function TypingDots() {
  return (
    <span className="flex h-4 items-center gap-1" role="status">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="size-1.5 animate-[typing-dot_1.1s_ease-in-out_infinite] rounded-full bg-ink-subtle"
          style={{ animationDelay: `${index * 0.16 - 1.1}s` }}
        />
      ))}
      <span className="sr-only">The assistant is thinking</span>
    </span>
  );
}

/**
 * What the agent put in the cart, and the way to pay for it.
 *
 * The button is the whole point of the handoff: the agent can fill a cart and
 * cannot spend anyone's money, so the last step is deliberately something the
 * customer does. It opens the cart sheet rather than jumping straight to
 * Stripe, because the cart is where they can still change their mind.
 */
function CartHandoff({
  lines,
  onOpenCart,
}: {
  lines: NonNullable<ChatMessage["cart"]>;
  onOpenCart: () => void;
}) {
  const total = lines.reduce((sum, line) => sum + line.unit_price_cents * line.quantity, 0);

  return (
    <div className="w-full rounded-lg border border-accent-soft bg-accent-soft/40 p-2">
      <ul className="flex flex-col gap-1.5">
        {lines.map((line) => (
          <li key={line.product_id} className="flex items-center gap-2">
            <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded border border-line bg-surface">
              {line.image_url ? (
                <img
                  src={line.image_url}
                  alt=""
                  width={28}
                  height={28}
                  className="size-full object-cover"
                />
              ) : (
                <ShoppingBag className="size-3 text-ink-subtle" aria-hidden />
              )}
            </span>
            <span className="min-w-0 flex-1 truncate text-2xs text-ink">{line.name}</span>
            <span className="shrink-0 text-2xs tabular-nums text-ink-muted">
              {line.quantity} &times; {formatMoney(line.unit_price_cents, line.currency)}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-2 flex items-center justify-between gap-2 border-t border-accent-soft pt-2">
        <span className="text-2xs text-ink-muted">
          Subtotal{" "}
          <span className="font-semibold tabular-nums text-ink">{formatMoney(total)}</span>
        </span>
        <Button size="sm" onClick={onOpenCart} icon={<ShoppingBag className="size-3" aria-hidden />}>
          View cart &amp; pay
        </Button>
      </div>
    </div>
  );
}
