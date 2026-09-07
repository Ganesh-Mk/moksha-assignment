import type { ComponentType } from 'react'

import { Navbar } from '@/components/layout/Navbar'
import { ProductShowcase } from '@/components/sections/ProductShowcase'
import { Testimonials } from '@/components/sections/Testimonials'

/**
 * The only parts of this page that need React in the browser.
 *
 * The page is prerendered to static HTML at build time and almost all of it stays that way —
 * headings, copy, images and links work with no JavaScript at all. Hydrating the whole tree
 * anyway cost 400-800ms of blocking main-thread work on a throttled phone, purely to attach
 * behaviour to thousands of nodes that have none.
 *
 * So only these three hydrate, each as its own React root mounted into the markup the server
 * already produced:
 *
 * - `navbar`      — the mobile menu Sheet
 * - `showcase`    — the product carousel, its thumbnails and the name that tracks the slide
 * - `testimonials`— the vertical quote carousel
 *
 * Everything else is left as inert HTML, which is what it already was.
 *
 * The contract: whatever App.tsx wraps in `<div data-island="x">` must be exactly what the
 * component named `x` renders here, or hydration will disagree with the server's markup.
 * Keeping both sides in this one map is what makes that easy to check.
 */
export const ISLANDS = {
  navbar: Navbar,
  showcase: ProductShowcase,
  testimonials: Testimonials,
} as const satisfies Record<string, ComponentType>

export type IslandName = keyof typeof ISLANDS
