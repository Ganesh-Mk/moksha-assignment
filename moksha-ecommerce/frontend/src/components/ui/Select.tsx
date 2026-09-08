import { Check, ChevronDown } from "lucide-react";
import * as RadixSelect from "@radix-ui/react-select";
import { useId } from "react";

import { cn } from "@/lib/cn";

/**
 * A select.
 *
 * On Radix rather than a native `<select>` because a native one cannot be
 * styled consistently across browsers, and rather than a hand-rolled listbox
 * because typeahead, roving focus, Home/End and correct `aria-activedescendant`
 * are a lot of detail to get right and very obvious when wrong.
 */
export interface SelectOption {
  value: string;
  label: string;
}

export function Select({
  label,
  value,
  onValueChange,
  options,
  placeholder = "Select…",
  hideLabel,
  className,
}: {
  label: string;
  value: string | undefined;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  hideLabel?: boolean;
  className?: string;
}) {
  const id = useId();

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className={cn("label-caps text-ink-muted", hideLabel && "sr-only")}>
        {label}
      </label>
      {/* Spread rather than pass `value={value}` directly: under
          exactOptionalPropertyTypes, an explicit `undefined` is not the same as
          an absent prop, and Radix switches between controlled and uncontrolled
          on exactly that difference. */}
      <RadixSelect.Root {...(value !== undefined ? { value } : {})} onValueChange={onValueChange}>
        <RadixSelect.Trigger
          id={id}
          className={cn(
            "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-line-strong",
            "bg-surface px-2.5 text-sm text-ink",
            "transition-[border-color,box-shadow] duration-(--dur-fast)",
            "hover:border-ink-subtle",
            "focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-ring)] focus:outline-none",
            "data-[placeholder]:text-ink-subtle",
          )}
        >
          <RadixSelect.Value placeholder={placeholder} />
          <RadixSelect.Icon>
            <ChevronDown className="size-3.5 text-ink-subtle" aria-hidden />
          </RadixSelect.Icon>
        </RadixSelect.Trigger>

        <RadixSelect.Portal>
          <RadixSelect.Content
            position="popper"
            sideOffset={4}
            className={cn(
              "z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden",
              "rounded-md border border-line bg-surface shadow-overlay",
              "data-[state=open]:animate-[scale-in_var(--dur-fast)_var(--ease-out)]",
            )}
          >
            <RadixSelect.Viewport className="p-1">
              {options.map((option) => (
                <RadixSelect.Item
                  key={option.value}
                  value={option.value}
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-2 rounded-sm px-2 py-1.5",
                    "text-sm text-ink outline-none select-none",
                    "data-[highlighted]:bg-surface-hover",
                    "data-[state=checked]:text-accent data-[state=checked]:font-medium",
                  )}
                >
                  <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
                  <RadixSelect.ItemIndicator>
                    <Check className="size-3.5" aria-hidden />
                  </RadixSelect.ItemIndicator>
                </RadixSelect.Item>
              ))}
            </RadixSelect.Viewport>
          </RadixSelect.Content>
        </RadixSelect.Portal>
      </RadixSelect.Root>
    </div>
  );
}
