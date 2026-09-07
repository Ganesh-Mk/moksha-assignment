import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge class names, with later Tailwind utilities winning over earlier ones.
 *
 * `clsx` alone would leave both `px-3` and `px-5` on the element and let source
 * order in the stylesheet decide — which is invisible and non-deterministic.
 * `twMerge` resolves the conflict, so a component's `className` prop reliably
 * overrides its own defaults.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
