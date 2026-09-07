import { AlertTriangle, MessageCircle, Send, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/authContext";
import { useChat } from "@/hooks/useChat";
import { cn } from "@/lib/cn";

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
  "Where is my order?",
];

export function ChatWidget() {
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
            <Sparkles className="size-3.5 text-accent" aria-hidden />
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
                  I can look up prices, stock and your own orders. I read the live database rather
                  than guessing.
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
                    "max-w-[85%] rounded-lg px-2.5 py-1.5 text-xs leading-relaxed",
                    "animate-[rise-in_var(--dur-fast)_var(--ease-out)]",
                    message.role === "user"
                      ? "self-end bg-accent text-accent-ink"
                      : "self-start border border-line bg-surface-sunken text-ink",
                  )}
                >
                  {message.error ? (
                    <span className="flex items-start gap-1.5 text-danger">
                      <AlertTriangle className="mt-px size-3 shrink-0" aria-hidden />
                      {message.error}
                    </span>
                  ) : (
                    <span className="whitespace-pre-wrap">
                      {message.content}
                      {/* A caret while this message is still streaming, so a
                          pause reads as "thinking" rather than "finished". */}
                      {isStreaming && message.role === "assistant" && !message.content ? (
                        <span className="inline-block h-3 w-1 animate-[caret-blink_1s_step-end_infinite] bg-ink-subtle align-middle" />
                      ) : null}
                    </span>
                  )}
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
