import { StrictMode } from 'react'
import { hydrateRoot } from 'react-dom/client'

import { ISLANDS, type IslandName } from '@/islands'
import '@/styles/globals.css'

/**
 * Hydrates only the interactive islands.
 *
 * By the time this runs the page is already painted and readable: the build prerenders the tree
 * to HTML and scripts/prerender.mjs replaces the module script with a loader that waits for the
 * first idle callback or the first real interaction. So there is no whole-page `hydrateRoot`
 * here — attaching React to the entire document cost 400-800ms of blocking main-thread work to
 * give behaviour to thousands of nodes that have none.
 *
 * In dev, index.html ships an empty root and Vite serves the modules directly, so there is
 * nothing prerendered to hydrate; that path renders the full app instead.
 */
async function mount() {
  const root = document.getElementById('root')

  if (!root?.hasChildNodes()) {
    // Dev: no prerendered markup, so render the whole app into the empty root.
    const [{ createRoot }, { default: App }] = await Promise.all([
      import('react-dom/client'),
      import('@/App.tsx'),
    ])
    if (!root) throw new Error('Root element #root not found in index.html')
    createRoot(root).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
    return
  }

  for (const el of document.querySelectorAll<HTMLElement>('[data-island]')) {
    const name = el.dataset.island as IslandName | undefined
    const Island = name ? ISLANDS[name] : undefined
    if (!Island) {
      // A wrapper with no matching component means App.tsx and islands.tsx have drifted apart.
      console.warn(`Unknown island "${name}" — nothing hydrated.`)
      continue
    }
    hydrateRoot(
      el,
      <StrictMode>
        <Island />
      </StrictMode>,
    )
  }
}

void mount()
