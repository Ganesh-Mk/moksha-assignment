import { ASSETS, type AssetName } from '@/content/assets.generated'
import { cn } from '@/lib/utils'

interface PictureProps {
  /** Key into the generated manifest. A typo is a compile error, not a 404. */
  asset: AssetName
  /**
   * Overrides the manifest's default. Pass `''` for art that carries no information — a
   * decorative leaf or splash — so screen readers skip it instead of announcing a filename.
   */
  alt?: string
  className?: string
  /** Applied to the <img>, for object-fit and rounding that must clip the bitmap itself. */
  imgClassName?: string
  /**
   * The `sizes` attribute. Getting this right is what makes the srcset worth having: without
   * it a browser assumes 100vw and downloads a far larger rendition than it will paint.
   */
  sizes?: string
  /**
   * Set on the one image that is the Largest Contentful Paint — the hero. It becomes eager,
   * high-priority and synchronously decoded. Everything else stays lazy.
   */
  priority?: boolean
}

/**
 * Every raster image on the page goes through here.
 *
 * Three things it guarantees, each of which is otherwise easy to get wrong 40 times over:
 *
 * - **No layout shift.** `width`/`height` come from the manifest, so the browser reserves the
 *   correct box before any byte of image data arrives. CLS on a 15,000px page with ~40 images
 *   is otherwise brutal.
 * - **Modern formats with a real fallback.** AVIF, then WebP, then a PNG `src`. The `<picture>`
 *   element does the negotiation; there is no JavaScript in the path.
 * - **Lazy by default.** Only the explicit `priority` image loads eagerly.
 */
export function Picture({
  asset,
  alt,
  className,
  imgClassName,
  sizes = '100vw',
  priority = false,
}: PictureProps) {
  const manifest = ASSETS[asset]
  const srcset = (formats: Readonly<Record<number, string>>) =>
    manifest.widths.map((w) => `${formats[w]} ${w}w`).join(', ')

  return (
    // <picture> is display:inline by default, which silently drops width, height and
    // aspect-ratio applied to it. Making it a block is what lets a caller size the box.
    <picture className={cn('block', className)}>
      <source type="image/avif" srcSet={srcset(manifest.avif)} sizes={sizes} />
      <source type="image/webp" srcSet={srcset(manifest.webp)} sizes={sizes} />
      <img
        src={manifest.fallback}
        alt={alt ?? manifest.alt}
        width={manifest.width}
        height={manifest.height}
        loading={priority ? 'eager' : 'lazy'}
        // Even the priority image decodes asynchronously. `sync` forces the browser to finish
        // decoding before it can paint anything, and an AVIF of this size on a throttled phone
        // turns that into a measurable delay to the largest contentful paint.
        decoding="async"
        // `fetchPriority` promotes the LCP image ahead of the rest of the waterfall.
        fetchPriority={priority ? 'high' : 'auto'}
        className={cn('h-auto w-full', imgClassName)}
      />
    </picture>
  )
}
