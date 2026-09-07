import { Picture } from '@/components/primitives/Picture'
import { ScrollCue } from '@/components/primitives/ScrollCue'
import { WaveDivider } from '@/components/primitives/WaveDivider'
import { hero, site } from '@/content/site'

/**
 * The opening band: y100–1233 in Figma, 1133px tall and full-bleed.
 *
 * Three things here are not what they look like, all confirmed against the node tree:
 *
 * 1. The purple background is a **raster image fill**, not a CSS gradient. It has a soft
 *    radial bloom behind the headline that no `linear-gradient` reproduces, so it ships as an
 *    optimised image and is the one `priority` asset on the page — it is the LCP element.
 * 2. The headline's fill is a **four-stop gradient** (navy → purple → purple → navy), applied
 *    to the text itself. `background-clip: text` with a solid fallback, via the
 *    `text-gradient-headline` utility in globals.css.
 * 3. The wavy overlay sits at **2% opacity**. It is texture, not pattern — barely perceptible,
 *    and omitted below `md` where it would cost a 1MB download to render ~nothing.
 *
 * Content sits in the upper-middle of the band rather than dead centre, matching the design's
 * 299px offset from the top of a 1133px band.
 *
 * The min-height sits on the <section>, not on the inner column, so the band's height is known
 * from the viewport alone. With it on the column the height depended on how the headline
 * wrapped, which depended on the webfont — and the background image, absolutely positioned to
 * fill the section, could not be laid out or painted until that font had loaded. That put the
 * largest contentful paint behind font loading and cost ~0.7s on mobile.
 */
export function Hero() {
  return (
    <section
      id="top"
      className="bg-brand-purple relative isolate min-h-[clamp(30rem,59vw,70.8125rem)] w-full overflow-hidden"
    >
      <Picture
        asset="hero-background"
        alt=""
        className="absolute inset-0 -z-20 h-full w-full"
        imgClassName="h-full w-full object-cover"
        sizes="100vw"
        priority
      />
      <Picture
        asset="pattern-waves-tan"
        alt=""
        className="absolute inset-0 -z-10 hidden h-full w-full opacity-[0.02] md:block"
        imgClassName="h-full w-full object-cover"
        sizes="100vw"
      />

      <div className="flex min-h-[inherit] flex-col items-center px-5 pt-[14%] pb-[18%] text-center">
        <Picture
          // The white-script variant, derived at build time — see DERIVED in
          // scripts/optimize-images.mjs. Figma makes it with a mask group that exports no
          // asset of its own, and no CSS filter lifts the cyan to white while keeping the
          // navy square dark, because the two differ in hue rather than brightness.
          asset="logo-lockup-hero"
          alt={`${site.brand} ${site.product}`}
          className="w-[clamp(8rem,10.6vw,12.75rem)]"
          sizes="(min-width: 1280px) 204px, 160px"
          priority
        />

        <h1 className="text-gradient-headline font-script text-display mt-[3.5%] max-w-[68rem]">
          {hero.headlineLines.map((line) => (
            <span key={line} className="inline md:block">
              {line}{' '}
            </span>
          ))}
        </h1>

        {/* Figma's `Line 33`: a 471x16 hand-drawn squiggle under the headline, stroked in a
            white gradient that fades at both ends. */}
        <svg
          aria-hidden="true"
          focusable="false"
          viewBox="0 0 471 16"
          className="mt-[2.5%] h-4 w-[clamp(12rem,24.5vw,29.4375rem)]"
          fill="none"
        >
          <defs>
            <linearGradient id="hero-flourish" x1="0" x2="471" gradientUnits="userSpaceOnUse">
              <stop stopColor="#fff" stopOpacity="0" />
              <stop offset="0.5" stopColor="#fff" stopOpacity="1" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M2 8C42 2 82 13 122 13S202 2 242 2s80 11 120 11 76-10 107-6"
            stroke="url(#hero-flourish)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>

        <ScrollCue
          href="#new-launch"
          label="Scroll to the Hydra Curls range"
          className="text-brand-purple-light/70 mt-[2%]"
        />
      </div>

      {/* Closes the purple band into the page. `above` stays transparent so the background
          photograph runs right up to the wave instead of meeting a flat purple approximation. */}
      <WaveDivider className="absolute inset-x-0 bottom-0" />
    </section>
  )
}
