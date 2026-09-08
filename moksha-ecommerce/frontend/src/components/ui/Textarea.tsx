import { forwardRef, useId, type TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
  error?: string | undefined;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, className, id, ...props },
  ref,
) {
  const generated = useId();
  const fieldId = id ?? generated;
  const messageId = `${fieldId}-message`;
  const message = error ?? hint;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="label-caps text-ink-muted">
        {label}
      </label>
      <textarea
        ref={ref}
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={message ? messageId : undefined}
        className={cn(
          "min-h-20 w-full resize-y rounded-md border bg-surface px-2.5 py-2 text-sm text-ink",
          "placeholder:text-ink-subtle",
          "transition-[border-color,box-shadow] duration-(--dur-fast) ease-out",
          "focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-ring)] focus:outline-none",
          error ? "border-danger" : "border-line-strong",
          className,
        )}
        {...props}
      />
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
