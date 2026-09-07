#!/usr/bin/env node
/**
 * Turns the built SPA shell into a static HTML page.
 *
 *   Runs as part of `npm run build`, after both the client and SSR builds.
 *
 * Three transforms, in order of how much they matter:
 *
 * 1. **Inject the prerendered markup.** Without it the page is an empty <div id="root"> and
 *    nothing paints until the bundle has downloaded, parsed and executed — seconds of blank
 *    screen on a throttled connection, for a page whose content never changes.
 *
 * 2. **Inline the stylesheet.** The CSS is render-blocking by definition, and at ~9KB gzipped
 *    it is cheaper to carry inside the document than to spend a round trip fetching.
 *
 * 3. **Defer the bundle.** Once the HTML is prerendered, JavaScript is needed only for the
 *    mobile menu and the two carousels. Evaluating it eagerly was 2.8s of render delay on a
 *    throttled phone — the page was painted and readable but the main thread was busy, so the
 *    browser could not report the paint. It now loads on the first idle callback, or
 *    immediately on the first real interaction, whichever comes first.
 *
 * The interaction listeners are the important half: they mean someone who taps the menu the
 * instant the page appears gets the bundle fetched right then, rather than waiting for idle.
 */

import { readFile, writeFile, rm } from 'node:fs/promises'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const APP = resolve(__dirname, '..')
const DIST = join(APP, 'dist')
const INDEX = join(DIST, 'index.html')
const SSR_ENTRY = join(APP, 'dist-ssr', 'entry-server.js')

const fail = (msg) => {
  console.error(`\n  ✖ ${msg}\n`)
  process.exit(1)
}

const { render } = await import(pathToFileURL(SSR_ENTRY).href)
const html = render()

let template = await readFile(INDEX, 'utf8')

/* ------------------------------------------------------- 1. prerendered markup --- */

const ROOT_MARKER = '<div id="root"></div>'
if (!template.includes(ROOT_MARKER)) fail(`${ROOT_MARKER} not found in dist/index.html`)
template = template.replace(ROOT_MARKER, `<div id="root">${html}</div>`)

/* ------------------------------------------------------------ 2. inline the CSS --- */

const cssTag = template.match(/<link rel="stylesheet" crossorigin href="([^"]+)"\s*\/?>/)
if (cssTag) {
  const cssPath = join(DIST, cssTag[1].replace(/^\//, ''))
  const css = await readFile(cssPath, 'utf8')
  template = template.replace(cssTag[0], `<style>${css}</style>`)
  await rm(cssPath, { force: true })
  console.log(`   ✓ inlined ${(css.length / 1024).toFixed(0)}KB of CSS`)
} else {
  console.warn('   ! no stylesheet link found — skipping CSS inlining')
}

/* --------------------------------------------------------- 3. defer the bundle --- */

const scriptTag = template.match(/<script type="module"[^>]*src="([^"]+)"><\/script>/)
if (!scriptTag) fail('no module script found in dist/index.html')

const loader = `<script>
(function () {
  var src = ${JSON.stringify(scriptTag[1])};
  var loaded = false;
  function load() {
    if (loaded) return;
    loaded = true;
    var el = document.createElement('script');
    el.type = 'module';
    el.src = src;
    document.head.appendChild(el);
  }
  // Whichever comes first: the browser going idle, or someone actually trying to use the page.
  ['pointerdown', 'keydown', 'touchstart'].forEach(function (evt) {
    addEventListener(evt, load, { once: true, passive: true });
  });
  if ('requestIdleCallback' in window) {
    requestIdleCallback(load, { timeout: 3000 });
  } else {
    setTimeout(load, 1200);
  }
})();
</script>`

template = template.replace(scriptTag[0], loader)

await writeFile(INDEX, template)
await rm(join(APP, 'dist-ssr'), { recursive: true, force: true })

console.log(`   ✓ prerendered ${(html.length / 1024).toFixed(0)}KB of HTML, bundle deferred`)
