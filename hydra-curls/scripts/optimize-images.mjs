#!/usr/bin/env node
/**
 * Turns the raw Figma image fills into what actually ships.
 *
 *   Usage:  node scripts/optimize-images.mjs [--force]
 *   Reads:  public/assets/figma/<imageRef>.png      (77MB, gitignored, regenerable)
 *   Writes: public/assets/optimized/<name>-<w>.avif|.webp   + one .png fallback
 *           src/content/assets.generated.ts        typed manifest
 *
 * Why this exists: the page is 15,000px tall and references 48 distinct images. Served as the
 * raw PNGs that is ~77MB, which no amount of lazy-loading rescues. Re-encoded to AVIF/WebP at
 * sensible widths it lands in single-digit MB, and every <img> gets intrinsic dimensions from
 * the generated manifest so cumulative layout shift stays at zero.
 *
 * Two decisions worth explaining:
 *
 * 1. NAME MAP. Figma names assets by content hash. `hero-background.avif` is legible to a
 *    reviewer and `082ae4cd….png` is not, so every shipped asset is renamed by the role it
 *    plays. The map below is also the record of which assets are used at all — 48 of the 95
 *    downloaded refs appear in the node tree, and the rest are unreferenced.
 *
 * 2. ALPHA VARIANTS. Figma stores most cutouts twice: the original photo and a
 *    background-removed copy, under different imageRefs but at the same position and size.
 *    Where a subject sits on a coloured band we want the alpha copy; where it is a full-bleed
 *    photograph we want the larger opaque original. Each pair is resolved explicitly below with
 *    the reason, rather than shipping both and picking in the markup.
 */

import { mkdir, writeFile, readdir, rm, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const APP = resolve(__dirname, '..')
const SRC_DIR = join(APP, 'public', 'assets', 'figma')
const OUT_DIR = join(APP, 'public', 'assets', 'optimized')
const MANIFEST = join(APP, 'src', 'content', 'assets.generated.ts')

const force = process.argv.includes('--force')

/**
 * imageRef -> shipped name. Order follows the page top to bottom.
 * `skip` records the losing half of an alpha/opaque pair so the choice stays visible.
 */
const ASSETS = [
  // --- Hero -------------------------------------------------------------------
  { ref: '082ae4cdd5cd', name: 'hero-background', alt: '' },
  { ref: '0b77fddd3c8a', name: 'pattern-waves-tan', alt: '' },

  // --- New Launch -------------------------------------------------------------
  { skip: 'b6c13aca414f', why: 'opaque twin of palm-leaf; the leaf overlays the hero band' },
  { ref: '3e557e72cd57', name: 'palm-leaf', alt: '' },
  { skip: 'eb8afa72c01d', why: 'opaque twin of bottle-shampoo-hero' },
  { ref: 'c4a3d68360ac', name: 'bottle-shampoo-hero', alt: 'Hydra Curls Hydrating Shampoo bottle' },
  { ref: 'fc8a47574abf', name: 'water-splash', alt: '' },

  // --- Brand key visual -------------------------------------------------------
  { skip: '31a275175dfe', why: 'alpha twin is only 860x478; this band is full-bleed at 1920' },
  {
    ref: 'f053f2c5199b',
    name: 'brand-key-visual',
    alt: 'Hydra Curls range — shampoo, conditioner, gel, cream and mask with hyaluron, coconut and avocado',
  },

  // --- Benefit cards ----------------------------------------------------------
  { ref: 'd02c9901cbe4', name: 'pattern-waves-grey', alt: '' },
  { skip: 'ec2f3f3622c1', why: 'opaque twin of comb' },
  { ref: 'ca9a362a62fe', name: 'comb', alt: '' },
  { skip: '55fc0b26b988', why: 'opaque twin of bottle-conditioner-card' },
  {
    ref: '39822f820cce',
    name: 'bottle-conditioner-card',
    alt: 'Hydra Curls Hydrating Conditioner bottle',
  },
  { skip: '40fe536988f4', why: 'opaque twin of clouds; the clouds composite over a cyan band' },
  { ref: 'ea61562ff946', name: 'clouds', alt: '' },

  // --- Product showcase -------------------------------------------------------
  { ref: '8ca7a7ff2508', name: 'product-shampoo', alt: 'Hydra Curls Hydrating Shampoo' },
  { ref: 'f719c612695a', name: 'product-conditioner', alt: 'Hydra Curls Hydrating Conditioner' },
  { ref: 'c649ec9ec1cf', name: 'product-gel', alt: 'Hydra Curls Defining Gel' },
  { ref: '752595397d06', name: 'product-cream', alt: 'Hydra Curls Defining Cream' },
  { ref: 'c479b7b0c978', name: 'product-mask', alt: 'Hydra Curls Hydrating Mask' },

  // --- Hydra Curls promise ----------------------------------------------------
  { ref: '1ed28dee56e9', name: 'icon-arc', alt: '' },
  { ref: '068fa560542b', name: 'icon-clock', alt: '' },

  // --- Premium ingredients ----------------------------------------------------
  // Named for the card each one backs, checked against reference/slices/08-premium-ingredients:
  // Rectangle 31 is the blue water behind Hyaluronic Acid, Rectangle 32 the pale streaks behind
  // Coconut Oil, Rectangle 33 the coconut splash behind Avocado Extract.
  { ref: '8d41581bcf79', name: 'ingredient-hyaluronic', alt: '' },
  { ref: 'a5d7375734ca', name: 'ingredient-coconut', alt: '' },
  { ref: '414a79ed2134', name: 'ingredient-avocado', alt: '' },
  { ref: '0078de051209', name: 'icon-hydration', alt: '' },
  { ref: 'bf8846cbd01c', name: 'icon-palm', alt: '' },
  { ref: '5c8dd23ac590', name: 'icon-avocado', alt: '' },

  // --- Testimonials -----------------------------------------------------------
  { skip: 'f8ca0a232ca8', why: 'opaque twin; the model is cut out over the cyan band' },
  { ref: '5b5f9302b89c', name: 'testimonial-model', alt: '' },
  { ref: 'b98d7b0607eb', name: 'decor-wave', alt: '' },
  { ref: '20b88955d6e9', name: 'avatar-aisha', alt: '' },

  // --- Experts / influencers --------------------------------------------------
  { ref: 'a69fe24bcf7d', name: 'expert-1', alt: 'Curly hair transformation shared by a customer' },
  { ref: 'f55ef9a726a1', name: 'expert-2', alt: 'Curly hair styling result shared by a customer' },
  { ref: 'b61facaf365c', name: 'expert-3', alt: 'Defined curls after using Hydra Curls' },
  { ref: 'ea493e78481f', name: 'expert-4', alt: 'Customer showing her curl routine' },

  // --- Designed for you -------------------------------------------------------
  { skip: 'a96400ecfd21', why: 'opaque twin of logo-lockup' },
  { ref: '6bf7ee3c89ff', name: 'logo-lockup', alt: 'Parachute Advanced Hydra Curls' },
  { ref: 'ee7900b93317', name: 'hairtype-wavy', alt: 'Model with wavy type 2 hair' },
  { ref: '37886f694943', name: 'hairtype-curly', alt: 'Model with curly type 3 hair' },
  { ref: '9ec2f0ba5f63', name: 'hairtype-coily', alt: 'Model with coily type 4 hair' },

  // --- Learn & grow -----------------------------------------------------------
  { ref: 'b782e6576017', name: 'learn-1', alt: 'Woman with curly hair against a turquoise wall' },
  { ref: '3bc9ef5886d1', name: 'learn-2', alt: 'Woman with red curls against a pink wall' },
  { ref: 'b8ea1a21630c', name: 'learn-3', alt: 'Woman in a hat with curly hair against an orange wall' },

  // --- Footer -----------------------------------------------------------------
  { ref: '71f76da46a96', name: 'logo-footer', alt: 'Parachute Advanced Hydra Curls' },
  { skip: '30d1af7343da', why: 'opaque twin of wordmark; the wordmark sits on the dark footer' },
  { ref: 'b91622e42994', name: 'wordmark', alt: 'Hydra Curls' },
]

/**
 * Standard width ladder. Each asset emits the subset that is no wider than its own intrinsic
 * width — upscaling only inflates bytes without adding detail.
 */
const LADDER = [320, 480, 640, 768, 960, 1280, 1600, 1920, 2560]

const shipped = ASSETS.filter((a) => a.ref)
const skipped = ASSETS.filter((a) => a.skip)

if (!existsSync(SRC_DIR)) {
  console.error(`\n  ✖ ${SRC_DIR} not found. Run: node scripts/figma-extract.mjs\n`)
  process.exit(1)
}

if (force && existsSync(OUT_DIR)) await rm(OUT_DIR, { recursive: true })
await mkdir(OUT_DIR, { recursive: true })

const files = await readdir(SRC_DIR)
const findSource = (ref) => files.find((f) => f.startsWith(ref))

const manifest = {}
let totalOut = 0

for (const asset of shipped) {
  const file = findSource(asset.ref)
  if (!file) {
    console.error(`  ✖ no source for ${asset.name} (${asset.ref})`)
    process.exit(1)
  }

  const input = join(SRC_DIR, file)
  const image = sharp(input)
  const meta = await image.metadata()
  const intrinsic = meta.width ?? 0

  const widths = LADDER.filter((w) => w <= intrinsic)
  // A source narrower than the smallest ladder rung still needs one rendition.
  if (widths.length === 0) widths.push(intrinsic)
  // Always include the intrinsic width so the largest rendition is never a downscale
  // of an already-small asset.
  if (!widths.includes(intrinsic) && intrinsic < LADDER[LADDER.length - 1]) widths.push(intrinsic)

  const renditions = { avif: {}, webp: {} }

  // Encoding all widths of one asset concurrently keeps every core busy; sharp releases the
  // event loop during codec work, so this is a real speedup rather than interleaving.
  await Promise.all(
    widths.map(async (w) => {
      const avifPath = join(OUT_DIR, `${asset.name}-${w}.avif`)
      const webpPath = join(OUT_DIR, `${asset.name}-${w}.webp`)

      // Re-encoding is expensive and deterministic, so a run resumes rather than restarting.
      // `--force` wipes the directory up front when the settings below change.
      const [avif, webp] = await Promise.all([
        existsSync(avifPath)
          ? stat(avifPath)
          : sharp(input)
              .resize({ width: w, withoutEnlargement: true })
              // effort 4 is the knee of the curve: ~3x faster than 6 for a low-single-digit
              // percentage more bytes, and this runs on every asset at every width.
              .avif({ quality: 55, effort: 4 })
              .toFile(avifPath),
        existsSync(webpPath)
          ? stat(webpPath)
          : sharp(input)
              .resize({ width: w, withoutEnlargement: true })
              .webp({ quality: 78, effort: 4 })
              .toFile(webpPath),
      ])

      renditions.avif[w] = `/assets/optimized/${asset.name}-${w}.avif`
      renditions.webp[w] = `/assets/optimized/${asset.name}-${w}.webp`
      totalOut += avif.size + webp.size
    }),
  )

  // The <img src>: a last-resort rendition for engines that support neither AVIF nor WebP.
  // Capped at 768px on purpose — it is a floor, not a retina asset, and full-width PNG
  // fallbacks cost more in the repository than they can ever save a real visitor.
  // JPEG for opaque photographs, PNG only where transparency actually matters, since a
  // photographic PNG is several times the size of the equivalent JPEG for no visible gain.
  const transparent = meta.hasAlpha === true
  const ext = transparent ? 'png' : 'jpg'
  const fallbackPath = join(OUT_DIR, `${asset.name}.${ext}`)
  const resizedFallback = () =>
    sharp(input).resize({ width: Math.min(Math.max(...widths), 768), withoutEnlargement: true })
  const fallback = existsSync(fallbackPath)
    ? await stat(fallbackPath)
    : await (transparent
        ? resizedFallback().png({ compressionLevel: 9, palette: true })
        : resizedFallback().jpeg({ quality: 78, mozjpeg: true })
      ).toFile(fallbackPath)
  totalOut += fallback.size

  manifest[asset.name] = {
    width: meta.width ?? 0,
    height: meta.height ?? 0,
    widths,
    avif: renditions.avif,
    webp: renditions.webp,
    fallback: `/assets/optimized/${asset.name}.${ext}`,
    alt: asset.alt,
  }

  console.log(
    `  ✓ ${asset.name.padEnd(26)} ${String(meta.width).padStart(5)}x${String(meta.height).padEnd(5)} → ${widths.length} widths`,
  )
}

/* ------------------------------------------------------------------ manifest --- */

const entries = Object.entries(manifest)
  .map(([name, m]) => {
    const avif = Object.entries(m.avif)
      .map(([w, p]) => `      ${w}: '${p}',`)
      .join('\n')
    const webp = Object.entries(m.webp)
      .map(([w, p]) => `      ${w}: '${p}',`)
      .join('\n')
    return `  '${name}': {
    width: ${m.width},
    height: ${m.height},
    widths: [${m.widths.join(', ')}],
    avif: {
${avif}
    },
    webp: {
${webp}
    },
    fallback: '${m.fallback}',
    alt: ${JSON.stringify(m.alt)},
  },`
  })
  .join('\n')

const ts = `/**
 * GENERATED FILE — do not edit by hand.
 * Run \`npm run images\` to regenerate from public/assets/figma/.
 *
 * Every shipped image, with its intrinsic dimensions and the widths available in each format.
 * <Picture> consumes this, which is what lets every <img> carry correct width/height and keeps
 * cumulative layout shift at zero across a 15,000px page.
 */

export interface AssetRenditions {
  readonly width: number
  readonly height: number
  readonly widths: readonly number[]
  readonly avif: Readonly<Record<number, string>>
  readonly webp: Readonly<Record<number, string>>
  readonly fallback: string
  /** Default alt text, overridable at the call site. Empty means decorative. */
  readonly alt: string
}

export const ASSETS = {
${entries}
} as const satisfies Record<string, AssetRenditions>

export type AssetName = keyof typeof ASSETS
`

await mkdir(dirname(MANIFEST), { recursive: true })
await writeFile(MANIFEST, ts)

console.log(`\n  ${shipped.length} assets shipped, ${skipped.length} alpha/opaque twins skipped`)
console.log(`  output: ${(totalOut / 1e6).toFixed(1)} MB across all widths and formats`)
console.log(`  manifest: ${MANIFEST}\n`)
