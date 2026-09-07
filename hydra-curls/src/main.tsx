import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'

import App from '@/App.tsx'
import '@/styles/globals.css'

const root = document.getElementById('root')
if (!root) throw new Error('Root element #root not found in index.html')

const app = (
  <StrictMode>
    <App />
  </StrictMode>
)

if (root.hasChildNodes()) {
  /*
   * The build prerenders the whole tree into index.html, so the page is painted and readable
   * before this file is even fetched — scripts/prerender.mjs replaces the module script with a
   * loader that waits for the first idle callback or the first real interaction.
   *
   * That deferral lives in the HTML rather than here on purpose: deferring inside this module
   * would still pay the cost of downloading and evaluating the bundle before first paint,
   * which was the 2.8s of render delay this is meant to remove. By the time this runs, the
   * decision to hydrate has already been made, so it hydrates immediately.
   */
  hydrateRoot(root, app)
} else {
  // Dev only: index.html still ships an empty root there, so there is nothing to hydrate.
  createRoot(root).render(app)
}
