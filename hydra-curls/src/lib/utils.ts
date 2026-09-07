import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * tailwind-merge resolves conflicting utilities so a caller's `className` reliably wins over a
 * component's defaults, instead of the outcome depending on stylesheet order.
 *
 * It has to be told about the custom scales in globals.css. Out of the box it does not
 * recognise `text-h2` as a font size, so it files it under the same conflict group as
 * `text-ink` — a colour — and silently drops whichever comes first. That produced section
 * headings rendering at the browser default 16px while the `.text-h2` rule sat unused in the
 * stylesheet: no error, no warning, just quietly wrong type.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        {
          text: ['stat', 'display', 'h2', 'h2-cta', 'product', 'card', 'lead', 'body', 'micro'],
        },
      ],
      leading: [{ leading: ['tightest', 'script'] }],
    },
  },
})

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))
