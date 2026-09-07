#!/usr/bin/env node
/**
 * Copies the Latin woff2 for each shipped face into public/fonts/ under a stable name.
 *
 *   Runs as part of `npm run build` (and `npm run dev` via predev).
 *
 * Why not just @import the @fontsource CSS, as this project did first:
 *
 * 1. **Preloading.** Vite content-hashes anything it pulls out of node_modules, so there is no
 *    stable URL to put in a <link rel="preload">. Without a preload the hero headline paints in
 *    the fallback face and then reflows when Kaushan Script arrives — that single swap was
 *    measuring 0.07 CLS on mobile, the page's entire layout-shift budget.
 * 2. **Weight.** @fontsource ships every subset (cyrillic, vietnamese, latin-ext). The
 *    `unicode-range` rules mean a browser never downloads them, but they are all copied into
 *    the build. This page is English-only, so only latin is emitted.
 *
 * The font packages stay as dependencies — this reads the files from them, so the licence and
 * provenance are still recorded in package.json rather than binaries appearing from nowhere.
 */

import { copyFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const APP = resolve(__dirname, '..')
const OUT = join(APP, 'public', 'fonts')

/** Only the Latin subset of each face, named for what it is rather than for its hash. */
const FONTS = [
  {
    from: '@fontsource-variable/montserrat/files/montserrat-latin-wght-normal.woff2',
    to: 'montserrat-latin-variable.woff2',
  },
  {
    from: '@fontsource/kaushan-script/files/kaushan-script-latin-400-normal.woff2',
    to: 'kaushan-script-latin-400.woff2',
  },
  {
    from: '@fontsource/caveat/files/caveat-latin-400-normal.woff2',
    to: 'caveat-latin-400.woff2',
  },
]

await mkdir(OUT, { recursive: true })

for (const font of FONTS) {
  const src = join(APP, 'node_modules', font.from)
  if (!existsSync(src)) {
    console.error(`\n  ✖ font not found: ${font.from}\n    Run npm install.\n`)
    process.exit(1)
  }
  await copyFile(src, join(OUT, font.to))
  console.log(`   ✓ fonts/${font.to}`)
}
