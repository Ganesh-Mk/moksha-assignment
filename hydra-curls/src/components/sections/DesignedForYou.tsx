import type { CSSProperties } from 'react'
import { ChevronRight } from 'lucide-react'

import { Container } from '@/components/layout/Container'
import { Eyebrow } from '@/components/primitives/Eyebrow'
import { Picture } from '@/components/primitives/Picture'
import { SectionHeading } from '@/components/primitives/SectionHeading'
import { decorativeArcText, hairTypes } from '@/content/sections'
import { site } from '@/content/site'

/**
 * The navy medallion above the heading: a 239px disc with the brand name running right around
 * its rim and the lockup at its centre.
 *
 * Built here rather than through CurvedText because a closed circle is a different path from an
 * arc — CurvedText's API is a chord and a sag, which cannot express 360°.
 */
function BrandMedallion() {
  const pathId = 'medallion-rim'

  return (
    <div className="relative mx-auto size-[9.5rem] md:size-[14.9375rem]">
      <svg viewBox="0 0 240 240" className="size-full" aria-hidden="true" focusable="false">
        <circle cx="120" cy="120" r="120" className="fill-brand-navy-deep" />
        <defs>
          {/* Starts at the top and runs clockwise, so the text reads left-to-right along the top. */}
          <path id={pathId} d="M120 22a98 98 0 1 1 0 196 98 98 0 1 1 0-196" fill="none" />
        </defs>
        <text className="font-curved fill-white" fontSize="17">
          <textPath href={`#${pathId}`} startOffset="50%" textAnchor="middle">
            {decorativeArcText}
          </textPath>
        </text>
      </svg>
      <Picture
        asset="logo-lockup-hero"
        alt={`${site.brand} ${site.product}`}
        className="absolute top-1/2 left-1/2 w-[52%] -translate-x-1/2 -translate-y-1/2"
        sizes="120px"
      />
    </div>
  )
}

/**
 * y10255–11877. Three hair-type cards under the medallion.
 *
 * Figma keeps a blue `Rectangle 152` panel holding each card's CHARACTERISTICS list positioned
 * *above* the card artwork, outside the card's own bounds, and the reference render does not
 * show it — it is an alternate state parked outside the frame while the component was edited,
 * not part of the card's resting appearance.
 *
 * Kept as a hover overlay so the copy is not simply discarded. It is hidden with opacity rather
 * than `display: none`, which leaves it in the accessibility tree: a screen-reader user hears
 * the characteristics even though the resting card does not paint them.
 */
export function DesignedForYou() {
  return (
    <section
      id="hair-types"
      aria-labelledby="hair-types-heading"
      className="bg-brand-cyan-soft relative w-full overflow-hidden pb-16 md:pb-24"
    >
      {/* Clouds bleed off the top-left corner behind the medallion. */}
      <Picture
        asset="clouds"
        alt=""
        className="pointer-events-none absolute -top-[2%] -left-[6%] w-[42%] opacity-90"
        sizes="42vw"
      />

      <Container className="relative pt-10 md:pt-14">
        <BrandMedallion />

        <Eyebrow className="mt-10">{hairTypes.eyebrow}</Eyebrow>
        <SectionHeading
          id="hair-types-heading"
          lines={hairTypes.heading}
          className="mt-6 text-center"
        />
        <p className="font-script text-lead leading-script text-grey-500 mx-auto mt-6 max-w-[45.125rem] text-center">
          {hairTypes.lead}
        </p>
      </Container>

      <ul className="xl:px-gutter mt-14 grid gap-6 px-5 md:grid-cols-2 md:px-10 lg:grid-cols-3">
        {hairTypes.items.map((type, index) => (
          <li key={type.label} data-reveal="" style={{ '--reveal-i': index } as CSSProperties}>
            <article className="group relative isolate aspect-[619/774] overflow-hidden rounded-lg">
              <Picture
                asset={type.image}
                className="absolute inset-0 -z-10 h-full w-full"
                imgClassName="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:group-hover:scale-100"
                sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
              />

              {/* The lockup and the script label are already part of each card's artwork, so
                  the heading is screen-reader only — painting it again would double both. */}
              <h3 className="sr-only">{type.label}</h3>

              {/* Hidden with opacity rather than `display: none`, so the characteristics stay
                  in the accessibility tree and are announced even though the resting card —
                  matching the reference render — does not show them. */}
              <div className="bg-brand-blue absolute inset-x-0 bottom-0 translate-y-full p-6 opacity-0 group-hover:translate-y-0 group-hover:opacity-100">
                <p className="text-body leading-relaxed text-white">{type.summary}</p>
                <p className="text-micro mt-6 tracking-[0.08em] text-white/85">
                  {hairTypes.characteristicsLabel}
                </p>
                <ul className="mt-2 space-y-2">
                  {type.characteristics.map((item) => (
                    <li key={item} className="text-body flex items-center gap-2 text-white">
                      <ChevronRight aria-hidden="true" className="size-5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  )
}
