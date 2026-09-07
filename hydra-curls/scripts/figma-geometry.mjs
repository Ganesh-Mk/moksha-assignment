#!/usr/bin/env node
/**
 * Fetches the frame 1:503 node tree *with vector path geometry*.
 *
 *   Usage:  node scripts/figma-geometry.mjs [--force]
 *   Reads:  ../.env  (repo root)  -> FIGMA_TOKEN, FIGMA_FILE_KEY
 *   Writes: ../docs/figma/raw/nodes-geometry.json
 *
 * Why a separate file rather than a flag on figma-extract.mjs: `geometry=paths` makes Figma
 * resolve every VECTOR node into SVG path data, which inflates the payload several-fold.
 * `nodes.json` is the file we grep constantly for measurements, so it stays lean; this one is
 * opened only when a shape has to be reproduced exactly.
 *
 * What it unlocks: the two cyan wave dividers, the hero underline flourish, the chevron scroll
 * cue and the curved-text baselines are all VECTOR nodes. Without path data they would have to
 * be traced by hand off a raster render; with it they are exact inline SVG.
 *
 * This hits /v1/files/:key/nodes, not the image render endpoint — but the 429 budget is shared
 * across the file, so it can still be limited right after a render run. Hence the backoff.
 */

import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
const RAW_DIR = join(ROOT, 'docs', 'figma', 'raw');
const OUT = join(RAW_DIR, 'nodes-geometry.json');
const FRAME_ID = '1:503';

const force = process.argv.includes('--force');

function fail(msg) {
  console.error(`\n  ✖ ${msg}\n`);
  process.exit(1);
}

async function loadEnv() {
  const envPath = join(ROOT, '.env');
  if (!existsSync(envPath)) fail(`No .env at ${envPath}.`);
  const env = {};
  for (const line of (await readFile(envPath, 'utf8')).split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  }
  if (!env.FIGMA_TOKEN) fail('FIGMA_TOKEN missing from .env');
  if (!env.FIGMA_FILE_KEY) fail('FIGMA_FILE_KEY missing from .env');
  return env;
}

if (existsSync(OUT) && !force) {
  console.log(`   ✓ ${OUT} already exists — pass --force to refetch`);
  process.exit(0);
}

const { FIGMA_TOKEN, FIGMA_FILE_KEY } = await loadEnv();
const url =
  `https://api.figma.com/v1/files/${FIGMA_FILE_KEY}/nodes` +
  `?ids=${encodeURIComponent(FRAME_ID)}&geometry=paths`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * The 429 cooldown on this file is minutes, not seconds, so back off in minutes rather than the
 * usual sub-second retry ladder. Total patience here is ~30 minutes, which is fine for a
 * background job whose output is not needed until the wave divider gets built.
 */
async function fetchWithBackoff(attempt = 1) {
  const res = await fetch(url, { headers: { 'X-Figma-Token': FIGMA_TOKEN } });
  if (res.status !== 429) return res;
  if (attempt > 12) fail('Still rate limited after 12 attempts. Re-run later.');
  const wait = Math.min(60_000 * attempt, 240_000);
  console.log(`   rate limited (attempt ${attempt}) — waiting ${wait / 1000}s…`);
  await sleep(wait);
  return fetchWithBackoff(attempt + 1);
}

console.log('   fetching node tree with geometry=paths…');
const res = await fetchWithBackoff();
if (!res.ok) fail(`Figma returned ${res.status}: ${(await res.text()).slice(0, 300)}`);

const json = await res.json();
if (!json.nodes?.[FRAME_ID]) fail(`Frame ${FRAME_ID} missing from the response.`);

await mkdir(RAW_DIR, { recursive: true });
await writeFile(OUT, JSON.stringify(json, null, 2));

// A geometry fetch that silently returns no paths is the failure mode worth catching here,
// since every downstream inline SVG depends on it.
const serialized = JSON.stringify(json);
const withPaths = (serialized.match(/"fillGeometry"/g) ?? []).length;
console.log(`   ✓ ${OUT}`);
console.log(`     ${(serialized.length / 1e6).toFixed(1)} MB · ${withPaths} nodes carry fillGeometry`);
if (withPaths === 0) fail('Response contained no fillGeometry — the geometry=paths param did not take.');
