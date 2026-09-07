#!/usr/bin/env node
/**
 * Figma extraction pipeline for Assignment 1 (Hydra Curls).
 *
 * Pulls everything needed to build the page offline, so you are never guessing at a
 * measurement or a colour and never blocked on Figma being reachable.
 *
 *   Usage:  node scripts/figma-extract.mjs [--skip-images] [--skip-sections]
 *   Reads:  ../.env  (repo root)  -> FIGMA_TOKEN, FIGMA_FILE_KEY
 *
 * Outputs:
 *   ../docs/figma/raw/nodes.json            full node tree for frame 1:503
 *   ../docs/figma/raw/image-refs.json       imageRef -> S3 url map
 *   ../docs/figma/reference/full-page.png   whole frame, for side-by-side diffing
 *   ../docs/figma/reference/sections/*.png  every top-level node rendered alone
 *   assets-src/figma/*.png                  all image fills (build input, NOT served)
 *
 * Every download is resume-safe: an existing file is skipped, so re-running after a
 * rate-limit bail picks up where it stopped rather than starting over.
 *
 * A read-only Figma personal access token is sufficient; view access on the file is enough.
 */

import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..', '..') // D:\Prep\Moksha
const APP = resolve(__dirname, '..') // hydra-curls

const RAW_DIR = join(ROOT, 'docs', 'figma', 'raw')
const REF_DIR = join(ROOT, 'docs', 'figma', 'reference')
const SECTION_DIR = join(REF_DIR, 'sections')
// Deliberately outside public/: Vite copies everything under publicDir into the build,
// and these 77MB of raw PNGs are an input to optimize-images.mjs, not something to serve.
const ASSET_DIR = join(APP, 'assets-src', 'figma')

const args = new Set(process.argv.slice(2))

/* ------------------------------------------------------------------ env --- */

async function loadEnv() {
  const envPath = join(ROOT, '.env')
  if (!existsSync(envPath)) {
    fail(`No .env at ${envPath}. Copy .env.example and add FIGMA_TOKEN + FIGMA_FILE_KEY.`)
  }
  const text = await readFile(envPath, 'utf8')
  const env = {}
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
  }
  if (!env.FIGMA_TOKEN) fail('FIGMA_TOKEN missing from .env')
  if (!env.FIGMA_FILE_KEY) fail('FIGMA_FILE_KEY missing from .env')
  return env
}

function fail(msg) {
  console.error(`\n  ✖ ${msg}\n`)
  process.exit(1)
}

const log = (...a) => console.log('  ', ...a)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/* ------------------------------------------------------------------ api --- */

/**
 * Figma rate-limits image rendering aggressively (it is doing real work per call).
 * Back off generously and, when `soft`, hand back null so the caller can skip a batch
 * instead of losing the whole run.
 */
async function api(path, token, { attempt = 1, soft = false } = {}) {
  const res = await fetch(`https://api.figma.com/v1${path}`, {
    headers: { 'X-Figma-Token': token },
  })
  if (res.status === 429) {
    if (attempt > 6) {
      if (soft) {
        console.warn('     ! still rate limited — skipping this batch, re-run to resume')
        return null
      }
      fail(
        'Figma rate limit exceeded. Wait a few minutes and re-run; already-downloaded files are skipped.',
      )
    }
    const wait = Math.min(2 ** attempt * 1000, 60_000)
    log(`rate limited, waiting ${wait / 1000}s…`)
    await sleep(wait)
    return api(path, token, { attempt: attempt + 1, soft })
  }
  if (!res.ok) {
    const body = await res.text()
    if (soft) {
      console.warn(`     ! ${res.status} on batch, skipping: ${body.slice(0, 120)}`)
      return null
    }
    fail(`Figma API ${res.status} on ${path}: ${body}`)
  }
  return res.json()
}

async function download(url, dest, attempt = 1) {
  // Resume support: an existing non-empty file is left alone, so re-running after a
  // rate-limit bail picks up where it stopped instead of starting over.
  if (existsSync(dest)) return true
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    await writeFile(dest, Buffer.from(await res.arrayBuffer()))
    return true
  } catch (err) {
    if (attempt <= 3) {
      await sleep(500 * attempt)
      return download(url, dest, attempt + 1)
    }
    console.warn(`     ! failed ${dest}: ${err.message}`)
    return false
  }
}

/** Bounded parallelism — 8 concurrent downloads is fast without tripping limits. */
async function pool(items, limit, worker) {
  const queue = [...items]
  let done = 0
  const runners = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) {
      const item = queue.shift()
      await worker(item)
      done += 1
      if (done % 10 === 0) log(`     …${done}/${items.length}`)
    }
  })
  await Promise.all(runners)
  return done
}

/* ----------------------------------------------------------------- main --- */

const FRAME_ID = '1:503'

async function main() {
  const env = await loadEnv()
  const { FIGMA_TOKEN: token, FIGMA_FILE_KEY: key } = env

  for (const d of [RAW_DIR, REF_DIR, SECTION_DIR, ASSET_DIR]) {
    await mkdir(d, { recursive: true })
  }

  /* 1. Node tree ---------------------------------------------------------- */
  log('1/4  Fetching node tree…')
  const nodes = await api(`/files/${key}/nodes?ids=${FRAME_ID}`, token)
  const frame = nodes.nodes[FRAME_ID]?.document
  if (!frame) fail(`Frame ${FRAME_ID} not found. Has the file changed?`)
  await writeFile(join(RAW_DIR, 'nodes.json'), JSON.stringify(nodes, null, 2))
  const box = frame.absoluteBoundingBox
  log(`     ${frame.name} — ${box.width}×${box.height}px, ${frame.children.length} top-level nodes`)

  /* 2. Full-page reference render ----------------------------------------- */
  log('2/4  Rendering full-page reference…')
  const fullDest = join(REF_DIR, 'full-page.png')
  if (existsSync(fullDest)) {
    log('     already present, skipping')
  } else {
    // scale 0.5 keeps the render under Figma's size ceiling for a 15k-tall frame while
    // staying sharp enough to measure against.
    const full = await api(`/images/${key}?ids=${FRAME_ID}&format=png&scale=0.5`, token, {
      soft: true,
    })
    const fullUrl = full?.images?.[FRAME_ID]
    if (fullUrl) {
      await download(fullUrl, fullDest)
      log('     -> docs/figma/reference/full-page.png')
    } else {
      console.warn('     ! full-page render skipped — re-run later to fetch it')
    }
  }

  /* 3. Per-section renders ------------------------------------------------ */
  if (!args.has('--skip-sections')) {
    log('3/4  Rendering sections…')
    const kids = frame.children
      .map((c) => ({ id: c.id, name: c.name, y: c.absoluteBoundingBox?.y ?? 0 }))
      .sort((a, b) => a.y - b.y)
      .map((k, i) => {
        const safe = k.name
          .replace(/[^a-z0-9]+/gi, '-')
          .toLowerCase()
          .slice(0, 40)
        const file = `${String(i).padStart(2, '0')}-y${Math.round(k.y)}-${safe}.png`
        return { ...k, dest: join(SECTION_DIR, file) }
      })

    const todo = kids.filter((k) => !existsSync(k.dest))
    log(
      `     ${kids.length - todo.length}/${kids.length} already present, ${todo.length} to render`,
    )

    // Batch the ids — the images endpoint accepts many at once. Keep batches small and
    // pause between them: rendering is the rate-limited operation, not downloading.
    const BATCH = 5
    let done = 0
    for (let i = 0; i < todo.length; i += BATCH) {
      const batch = todo.slice(i, i + BATCH)
      const ids = batch.map((k) => k.id).join(',')
      const out = await api(`/images/${key}?ids=${ids}&format=png&scale=1`, token, { soft: true })
      if (out) {
        await pool(batch, 4, async (k) => {
          const url = out.images?.[k.id]
          if (url) await download(url, k.dest)
        })
      }
      done += batch.length
      log(`     …${done}/${todo.length}`)
      if (i + BATCH < todo.length) await sleep(1500)
    }
    log('     -> docs/figma/reference/sections/')
  }

  /* 4. Image fills -------------------------------------------------------- */
  if (!args.has('--skip-images')) {
    log('4/4  Downloading image fills…')
    const imgs = await api(`/files/${key}/images`, token)
    const map = imgs.meta?.images ?? {}
    await writeFile(join(RAW_DIR, 'image-refs.json'), JSON.stringify(map, null, 2))
    const entries = Object.entries(map)
    log(`     ${entries.length} image fills`)
    const ok = await pool(entries, 8, async ([ref, url]) =>
      download(url, join(ASSET_DIR, `${ref}.png`)),
    )
    log(`     -> assets-src/figma/ (${ok} files)`)
    log('     NOTE: filenames are Figma imageRefs. Cross-reference nodes.json')
    log('           (fills[].imageRef) to see where each one is used, then rename')
    log('           to something meaningful as you build each section.')
  }

  log('\n   Done.\n')
}

main().catch((e) => fail(e.stack || e.message))
