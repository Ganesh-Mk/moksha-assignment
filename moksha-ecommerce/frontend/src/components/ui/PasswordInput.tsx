import { Eye, EyeOff } from "lucide-react";
import { forwardRef, useState } from "react";

import { Input, type InputProps } from "@/components/ui/Input";
import { cn } from "@/lib/cn";

/**
 * A password field with a reveal toggle.
 *
 * The toggle is a real `<button>`, not an icon with a click handler: it has to
 * be reachable by keyboard, and its `aria-pressed` is what tells a screen-reader
 * user whether their password is currently on screen — which is exactly the
 * thing they cannot check by looking.
 *
 * Revealing swaps `type` rather than a CSS mask, so the browser's own password
 * manager keeps working while the field is masked.
 */
export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputProps, "type" | "trailing">>(
  function PasswordInput(props, ref) {
    const [revealed, setRevealed] = useState(false);
    const Icon = revealed ? EyeOff : Eye;

    return (
      <Input
        ref={ref}
        type={revealed ? "text" : "password"}
        trailing={
          <button
            type="button"
            onClick={() => setRevealed((shown) => !shown)}
            aria-pressed={revealed}
            className={cn(
              "flex size-7 items-center justify-center rounded-sm text-ink-subtle",
              "transition-colors duration-[--dur-fast] hover:text-ink",
            )}
          >
            <Icon className="size-3.5" aria-hidden />
            <span className="sr-only">{revealed ? "Hide password" : "Show password"}</span>
          </button>
        }
        {...props}
      />
    );
  },
);
