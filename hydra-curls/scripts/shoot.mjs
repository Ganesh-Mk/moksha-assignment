#!/usr/bin/env node
/**
 * Screenshots the running dev server at every breakpoint and reports layout problems.
 *
 *   npm run dev                       (in another terminal)
 *   node scripts/shoot.mjs                        all breakpoints, full page
 *   node scripts/shoot.mjs --w 375 --w 1440       only these widths
 *   node scripts/shoot.mjs --clip 0 1400          only this y-range (one section)
 *   node scripts/shoot.mjs --section 3            only the 4th <section>, measured in the DOM
 *   node scripts/shoot.mjs --out hero             name the output files
 *
 * Beyond the images it runs two checks that are tedious to do by eye and easy to regress:
 *
 * - **Horizontal overflow.** Any element wider than the document is reported with a selector.
 *   The absolutely positioned decorative art is the usual culprit and the failure only shows
 *   at widths nobody thought to open.
 * - **Tap targets.** Interactive elements smaller than 44x44 CSS px are listed.
 *
 * Note it deliberately defeats two runtime behaviours so the capture shows the settled page:
 * lazy images are promoted to eager, and scroll reveals are forced to their revealed state.
 * Both are verified separately — the lazy/eager split is reported per run, and the reveal
 * behaviour has its own browser test — rather than being hidden by the screenshot.
 *
 * Uses the locally installed Chrome rather than a downloaded Chromium, since Playwright's
 * browser download is blocked on this machine.
 */

import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'

const BREAKPOINTS = [320, 375, 768, 1024, 1440, 1920]
const URL = process.env.SHOOT_URL ?? 'http://localhost:5173/'

const argv = process.argv.slice(2)
const readAll = (flag) =>
  argv.flatMap((a, i) => (a === flag ? [Number(argv[i + 1])] : []))
const readOne = (flag, fallback) => {
  const i = argv.indexOf(flag)
  return i === -1 ? fallback : argv[i + 1]
}

const widths = readAll('--w').length ? readAll('--w') : BREAKPOINTS
const clipIndex = argv.indexOf('--clip')
const clip = clipIndex === -1 ? null : { y: Number(argv[clipIndex + 1]), h: Number(argv[clipIndex + 2]) }
const sectionIndex = readOne('--section', null)
const outName = readOne('--out', 'page')
const outDir = readOne('--dir', 'screenshots')

await mkdir(outDir, { recursive: true })

const browser = await chromium.launch({ channel: 'chrome' })

for (const width of widths) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    deviceScaleFactor: 1,
  })
  const page = await context.newPage()
  await page.goto(URL, { waitUntil: 'networkidle' })

  // Count the lazy/eager split *before* forcing anything, so the loading strategy is still
  // verified even though the capture below has to defeat it.
  const loading = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll('img')]
    return { total: imgs.length, eager: imgs.filter((i) => i.loading === 'eager').length }
  })

  // Chrome does not paint lazy images that sit outside the original viewport when it takes a
  // fullPage screenshot — they come out blank even though the page is perfectly fine. Scrolling
  // through is not enough, because the decoded frames are evicted again on the way back up. So
  // every image is promoted to eager and explicitly decoded before the capture.
  // This is a screenshot-harness workaround, not a change to how the page loads.
  await page.evaluate(async () => {
    const imgs = [...document.querySelectorAll('img')]
    for (const img of imgs) img.loading = 'eager'
    const step = window.innerHeight
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 40))
    }
    window.scrollTo(0, 0)

    // Same class of workaround as the eager promotion above: scroll reveals are driven by an
    // IntersectionObserver, so a full-page capture taken from the top shows bands that were
    // never in view as still hidden. Force every reveal to its settled state and drop the
    // transition, so the screenshot is of the finished page rather than one mid-animation.
    for (const el of document.querySelectorAll('[data-reveal]')) {
      el.setAttribute('data-revealed', '')
      el.style.transition = 'none'
    }

    await Promise.all(imgs.map((img) => img.decode().catch(() => undefined)))
  })
  await page.waitForTimeout(500)

  // Clipping by hand-counted y offsets goes stale the moment a band above changes height.
  // `--section N` asks the page where that section actually is.
  let band = clip
  if (sectionIndex !== null) {
    band = await page.evaluate((i) => {
      const el = document.querySelectorAll('main > section, header')[Number(i)]
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { y: Math.round(r.top + window.scrollY), h: Math.round(r.height) }
    }, sectionIndex)
    if (!band) throw new Error(`no section at index ${sectionIndex}`)
  }

  const file = `${outDir}/${outName}-${width}.png`
  // `clip` is viewport-relative unless the shot is a full-page one, so `fullPage` stays on in
  // both modes and the clip just selects a band of the document.
  await page.screenshot({
    path: file,
    fullPage: true,
    ...(band ? { clip: { x: 0, y: band.y, width, height: band.h } } : {}),
  })

  const report = await page.evaluate(() => {
    const docWidth = document.documentElement.clientWidth
    const describe = (el) => {
      const id = el.id ? `#${el.id}` : ''
      const cls = typeof el.className === 'string' && el.className
        ? `.${el.className.trim().split(/\s+/).slice(0, 3).join('.')}`
        : ''
      return `${el.tagName.toLowerCase()}${id}${cls}`
    }

    // Decorative art is *meant* to bleed past the band edge; what matters is whether an
    // ancestor clips it. An element wider than the document inside an `overflow: hidden`
    // parent is the design working as intended, not a bug — only unclipped bleed can
    // actually produce a scrollbar.
    const isClipped = (el) => {
      for (let p = el.parentElement; p; p = p.parentElement) {
        const { overflowX } = getComputedStyle(p)
        if (overflowX === 'hidden' || overflowX === 'clip' || overflowX === 'auto') return true
      }
      return false
    }

    const overflow = []
    for (const el of document.querySelectorAll('*')) {
      const rect = el.getBoundingClientRect()
      if ((rect.right > docWidth + 1 || rect.left < -1) && !isClipped(el)) {
        overflow.push(`${describe(el)} [${Math.round(rect.left)}..${Math.round(rect.right)}]`)
      }
    }

    const small = []
    for (const el of document.querySelectorAll('a, button, input, [role="button"]')) {
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) continue
      if (rect.width < 44 || rect.height < 44) {
        small.push(`${describe(el)} ${Math.round(rect.width)}x${Math.round(rect.height)}`)
      }
    }

    return {
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: docWidth,
      height: document.body.scrollHeight,
      overflow: overflow.slice(0, 8),
      overflowCount: overflow.length,
      small: small.slice(0, 8),
      headings: [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => h.tagName),
    }
  })

  const scrolls = report.scrollWidth > report.clientWidth
  console.log(
    `${String(width).padStart(4)}px  h=${String(report.height).padStart(6)}  ` +
      `${scrolls ? `✖ SCROLLS (${report.scrollWidth} > ${report.clientWidth})` : '✓ no h-scroll'}` +
      `${report.overflowCount ? `  ✖ ${report.overflowCount} overflowing` : ''}` +
      `${report.small.length ? `  ✖ ${report.small.length} small targets` : ''}` +
      `  img ${loading.eager}/${loading.total} eager`,
  )
  for (const o of report.overflow) console.log(`        overflow: ${o}`)
  for (const s of report.small) console.log(`        tap<44px: ${s}`)
  if (width === widths[0]) console.log(`        headings: ${report.headings.join(' ')}`)

  await context.close()
}

await browser.close()
console.log(`\n  → ${outDir}/${outName}-*.png`)
