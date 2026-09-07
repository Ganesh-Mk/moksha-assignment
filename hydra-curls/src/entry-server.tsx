import { renderToString } from 'react-dom/server'

import App from '@/App'

/**
 * Server entry, used only at build time by scripts/prerender.mjs.
 *
 * This page is entirely static — no routing, no data fetching — so there is no reason for a
 * visitor's browser to parse ~100KB of JavaScript before it can paint anything. Rendering the
 * tree to HTML during the build means first paint depends on HTML and CSS alone, and React
 * hydrates afterwards to wire up the carousel and the mobile menu.
 *
 * This is the piece Next.js would otherwise have provided. Doing it in ~30 lines keeps the
 * build a plain Vite build, which was the reason for choosing Vite over Next in the first place.
 */
export function render() {
  return renderToString(<App />)
}
