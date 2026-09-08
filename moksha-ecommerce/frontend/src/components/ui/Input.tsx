import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * A labelled text input.
 *
 * The label is not optional. Every input here gets one, wired with a generated
 * id — a placeholder is not a label: it disappears the moment someone types,
 * and screen readers treat it as a hint rather than a name.
 *
 * When `error` is set the field is also marked `aria-invalid` and pointed at
 * the message with `aria-describedby`, so the error is announced rather than
 * only turning the border red.
 */
export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "prefix"> {
  label: string;
  hint?: string;
  error?: string | undefined;
  /**
   * Rendered inside the field on the left — a currency symbol, a search glass.
   * Named `adornment` rather than `prefix` because `prefix` is a real (if
   * obscure) HTML attribute and shadowing it with a different type is the kind
   * of collision that produces a baffling error six months later.
   */
  adornment?: ReactNode;
  /** Hide the label visually but keep it for assistive technology. */
  hideLabel?: boolean;
  /**
   * Rendered inside the field on the right — a reveal toggle, a unit, a clear
   * button. Unlike `adornment` this is *not* pointer-transparent, because the
   * things that belong on this side are usually interactive.
   */
  trailing?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, adornment, trailing, hideLabel, className, id, ...props },
  ref,
) {
  const generated = useId();
  const inputId = id ?? generated;
  const messageId = `${inputId}-message`;
  const message = error ?? hint;

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={inputId}
        className={cn("label-caps text-ink-muted", hideLabel && "sr-only")}
      >
        {label}
      </label>

      <div className="relative flex items-center">
        {adornment ? (
          <span className="pointer-events-none absolute left-2.5 text-ink-subtle" aria-hidden>
            {adornment}
          </span>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={message ? messageId : undefined}
          className={cn(
            "h-9 w-full rounded-md border bg-surface px-2.5 text-sm text-ink",
            "placeholder:text-ink-subtle",
            "transition-[border-color,box-shadow] duration-[--dur-fast] ease-out",
            "focus:outline-none focus-visible:outline-none",
            "focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-ring)]",
            "disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-subtle",
            adornment && "pl-7",
            trailing && "pr-10",
            error ? "border-danger" : "border-line-strong",
            className,
          )}
          {...props}
        />
        {trailing ? <span className="absolute right-1">{trailing}</span> : null}
      </div>

      {message ? (
        <p
          id={messageId}
          className={cn("text-xs", error ? "text-danger" : "text-ink-subtle")}
          role={error ? "alert" : undefined}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
});
