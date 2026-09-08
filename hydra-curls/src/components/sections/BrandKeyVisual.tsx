import { Picture } from '@/components/primitives/Picture'
import { SoftWave } from '@/components/primitives/SoftWave'
import { brandKeyVisual } from '@/content/sections'

/**
 * y2028–3126. The full-bleed campaign image.
 *
 * Everything in this band — the logo, the Hydra Curls wordmark, all five bottles, the model,
 * and the "HYALURON / COCONUT / AVOCADO" typography — is baked into one raster. Figma layers
 * a bottle node on top of it, but that node is fully occluded by the artwork; reproducing it
 * would paint a second bottle over the first.
 *
 * Because the image carries text, the alt text has to carry it too: a screen-reader user gets
 * nothing from "campaign image", and everything in here is a claim about the product.
 */
export function BrandKeyVisual() {
  return (
    <section aria-labelledby="key-visual-heading" className="bg-page relative w-full">
      <h2 id="key-visual-heading" className="sr-only">
        {brandKeyVisual.heading}
      </h2>

      {/* The campaign band does not begin on a straight line: in the reference the purple rises
          into the section above it on a wave, with a paler rim riding just ahead of it.

          The shape must NOT be flipped. SoftWave's path fills the bottom of its own box, so sat
          directly above the section it runs from the wavy edge down to the section's top with no
          seam. Flipping it filled the top of the box instead and left a band of page colour
          between the wave and the artwork — a straight edge under a stray purple stripe. */}
      <div className="pointer-events-none absolute inset-x-0 top-px z-10 -translate-y-full">
        <div className="relative">
          <SoftWave
            fillClassName="fill-brand-purple-light/50"
            className="absolute inset-x-0 -top-3 h-[clamp(3rem,7vw,8rem)]"
          />
          <SoftWave
            fillClassName="fill-brand-purple"
            className="relative h-[clamp(3rem,7vw,8rem)]"
          />
        </div>
      </div>
      <Picture
        asset="brand-key-visual"
        alt={brandKeyVisual.alt}
        // The band is 1920x1098 in Figma. Fixing the ratio keeps the box reserved before the
        // image decodes, which matters more here than anywhere else on the page — this is the
        // largest asset by a wide margin.
        className="aspect-[1920/1098] w-full"
        imgClassName="h-full w-full object-cover"
        sizes="100vw"
      />
    </section>
  )
}
