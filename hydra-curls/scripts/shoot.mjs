#!/usr/bin/env node
/**
 * Screenshots the running dev server at every breakpoint and reports layout problems.
 *
 *   npm run dev                       (in another terminal)
 *   node scripts/shoot.mjs                        all breakpoints, full page
 *   node scripts/shoot.mjs --w 375 --w 1440       only these widths
 *   node scripts/shoot.mjs --clip 0 1400          only this y-range (one section)
 *   node scripts/shoot.mjs --out hero             name the output files
 *
 * Beyond the images it runs two checks that are tedious to do by eye and easy to regress:
 *
 * - **Horizontal overflow.** Any element wider than the document is reported with a selector.
 *   The absolutely positioned decorative art is the usual culprit and the failure only shows
 *   at widths nobody thought to open.
 * - **Tap targets.** Interactive elements smaller than 44x44 CSS px are listed.
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
  // Lazy images below the fold never decode unless the page is actually scrolled through.
  await page.evaluate(async () => {
    const step = window.innerHeight
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 60))
    }
    window.scrollTo(0, 0)
  })
  await page.waitForTimeout(400)

  const file = `${outDir}/${outName}-${width}.png`
  // `clip` is viewport-relative unless the shot is a full-page one, so `fullPage` stays on in
  // both modes and the clip just selects a band of the document.
  await page.screenshot({
    path: file,
    fullPage: true,
    ...(clip ? { clip: { x: 0, y: clip.y, width, height: clip.h } } : {}),
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
      `${report.small.length ? `  ✖ ${report.small.length} small targets` : ''}`,
  )
  for (const o of report.overflow) console.log(`        overflow: ${o}`)
  for (const s of report.small) console.log(`        tap<44px: ${s}`)
  if (width === widths[0]) console.log(`        headings: ${report.headings.join(' ')}`)

  await context.close()
}

await browser.close()
console.log(`\n  → ${outDir}/${outName}-*.png`)
