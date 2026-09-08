import type { CSSProperties } from 'react'
import { ChevronRight } from 'lucide-react'

import { Container } from '@/components/layout/Container'
import { Eyebrow } from '@/components/primitives/Eyebrow'
import { Picture } from '@/components/primitives/Picture'
import { CircularText } from '@/components/primitives/CircularText'
import { SectionHeading } from '@/components/primitives/SectionHeading'
import { SoftWave } from '@/components/primitives/SoftWave'
import { decorativeArcText, hairTypes } from '@/content/sections'
import { site } from '@/content/site'
import { cn } from '@/lib/utils'

/**
 * The navy medallion above the heading: a 239px disc with the brand name running right around
 * its rim and the lockup at its centre.
 *
 * Built here rather than through CurvedText because a closed circle is a different path from an
 * arc — CurvedText's API is a chord and a sag, which cannot express 360°.
 */
function BrandMedallion() {
  return (
    <div className="relative mx-auto size-[9.5rem] md:size-[14.9375rem]">
      <svg viewBox="0 0 240 240" className="size-full" aria-hidden="true" focusable="false">
        <circle cx="120" cy="120" r="120" className="fill-brand-navy-deep" />
      </svg>
      <CircularText
        id="medallion"
        className="absolute inset-0 size-full text-white"
        textClassName="fill-white"
      >
        {decorativeArcText}
      </CircularText>
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
      {/* The band's top edge is a diagonal in the reference, not a horizontal: white carries
          over from the section above across the upper left and the cyan starts beneath it.
          Painted before the clouds so they sit on the white side of the line. */}
      <SoftWave
        fillClassName="fill-page"
        shape="diagonal"
        className="absolute inset-x-0 top-0 h-[clamp(5rem,18vw,20rem)]"
      />

      {/* Clouds bleed off the top-left corner behind the medallion. */}
      <Picture
        asset="clouds"
        alt=""
        className="pointer-events-none absolute -top-[1%] -left-[6%] z-10 w-[38%] opacity-90"
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
            <article className="group relative isolate aspect-[619/774] overflow-hidden rounded-lg transition-transform duration-500 ease-out hover:-translate-y-1.5 motion-reduce:hover:translate-y-0">
              <Picture
                asset={type.image}
                className="absolute inset-0 -z-10 h-full w-full"
                imgClassName="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:group-hover:scale-100"
                sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
              />

              {/* The lockup and the script label are already part of each card's artwork, so
                  the heading is screen-reader only — painting it again would double both. */}
              <h3 className="sr-only">{type.label}</h3>

              {/* A scrim that darkens the whole card as the panel rises, so the panel arrives
                  on a surface prepared for it instead of cutting a hard rectangle across a
                  bright photograph. */}
              <div
                aria-hidden="true"
                className="from-brand-navy-deep/85 via-brand-navy-deep/35 pointer-events-none absolute inset-0 bg-gradient-to-t to-transparent opacity-0 transition-opacity duration-500 ease-out group-hover:opacity-100"
              />

              {/* Hidden with opacity rather than `display: none`, so the characteristics stay
                  in the accessibility tree and are announced even though the resting card —
                  matching the reference render — does not show them.

                  It was a flat blue block that snapped in with no transition at all: the
                  utilities set the end state but nothing described how to get there. It now
                  rises and fades on the same curve as the scrim, over a blurred dark glass
                  panel that keeps the artwork readable underneath. */}
              <div
                className={cn(
                  'absolute inset-x-0 bottom-0 p-6',
                  'bg-brand-navy-deep/70 border-t border-white/15 backdrop-blur-md',
                  'translate-y-full opacity-0 transition-[transform,opacity] duration-500 ease-out',
                  'group-hover:translate-y-0 group-hover:opacity-100',
                  'group-focus-within:translate-y-0 group-focus-within:opacity-100',
                  'motion-reduce:transition-none',
                )}
              >
                <p className="text-body leading-relaxed text-white">{type.summary}</p>
                <p className="text-micro text-brand-cyan mt-6 tracking-[0.08em]">
                  {hairTypes.characteristicsLabel}
                </p>
                <ul className="mt-2 space-y-2">
                  {type.characteristics.map((item) => (
                    <li key={item} className="text-body flex items-center gap-2 text-white">
                      <ChevronRight
                        aria-hidden="true"
                        className="text-brand-cyan size-5 shrink-0"
                      />
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
