import type { CSSProperties } from 'react'
import { Check, Heart, Leaf, type LucideIcon } from 'lucide-react'

import { Container } from '@/components/layout/Container'
import { Section } from '@/components/layout/Section'
import { CurvedText } from '@/components/primitives/CurvedText'
import { Eyebrow } from '@/components/primitives/Eyebrow'
import { Picture } from '@/components/primitives/Picture'
import { SectionHeading } from '@/components/primitives/SectionHeading'
import { SoftWave } from '@/components/primitives/SoftWave'
import { decorativeArcText, ingredients, type TrustIcon } from '@/content/sections'
import { cn } from '@/lib/utils'

const TRUST_ICONS: Record<TrustIcon, LucideIcon> = {
  check: Check,
  heart: Heart,
  leaf: Leaf,
}

/**
 * y6636–7748. Three ingredient cards over a trust bar.
 *
 * Each card is 544x449 with a 20px radius and its photograph sitting at **15% opacity** behind
 * the copy — the cards read as tinted glass rather than as photo tiles, and using the image at
 * full strength would bury the text. The 107px icon disc is cyan at 15%, and the faint
 * "PREMIUM INGREDIENTS" label is white at 75% over the artwork.
 *
 * The trust ticks are all #34C759 but use three different glyphs, so the icon travels with the
 * copy in src/content rather than being positional.
 */
export function PremiumIngredients() {
  return (
    <Section
      id="ingredients"
      aria-labelledby="ingredients-heading"
      className="bg-page pb-[clamp(4.5rem,8vw,10rem)]"
    >
      {/* One of the 144-glyph Inter arcs. Kept faint — it is a watermark behind the
          content, not a label. Hidden below `lg`, where it would crowd the heading. */}
      <CurvedText
        id="ingredients-watermark"
        chord={900}
        sag={-620}
        fontSize={26}
        fontClassName="font-curved"
        className="text-ink/15 pointer-events-none absolute -top-[3%] -left-[13%] hidden w-[34%] lg:block"
      >
        {decorativeArcText}
      </CurvedText>

      <Container>
        <Eyebrow>{ingredients.eyebrow}</Eyebrow>
        <SectionHeading
          id="ingredients-heading"
          lines={ingredients.heading}
          className="mt-6 text-center"
        />
        <p className="font-script text-lead leading-script text-grey-500 mx-auto mt-6 max-w-[45.125rem] text-center">
          {ingredients.lead}
        </p>

        <ul className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {ingredients.cards.map((card, index) => (
            // The reveal lives on the <li> and the hover on the <article> inside it, and they
            // must stay on different elements. Both animate `transform`; sharing one element
            // meant the hover inherited the reveal's 0.7s duration *and* its stagger delay, so
            // a card lagged, then jumped, and fought itself if you moved away mid-transition.
            <li key={card.name} data-reveal="" style={{ '--reveal-i': index + 1 } as CSSProperties}>
              <article
                className={cn(
                  'group relative isolate h-full overflow-hidden rounded-[1.25rem] p-6',
                  'border border-black/15 transition-[transform,border-color] duration-300 ease-out',
                  // Lift and a brand-coloured edge rather than a drop shadow: these cards sit on
                  // a near-white page where a shadow just muddies the corners.
                  'hover:border-brand-cyan/70 hover:-translate-y-1.5',
                  'motion-reduce:hover:translate-y-0',
                )}
              >
                <Picture
                  asset={card.image}
                  alt=""
                  className="absolute inset-0 -z-10 h-full w-full opacity-15 transition-[opacity,transform] duration-500 ease-out group-hover:scale-[1.06] group-hover:opacity-25 motion-reduce:group-hover:scale-100"
                  imgClassName="h-full w-full object-cover"
                  sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                />

                <div className="bg-brand-cyan-mid/15 group-hover:bg-brand-cyan-mid/30 flex size-[6.6875rem] items-center justify-center rounded-full transition-colors duration-300">
                  <Picture asset={card.icon} alt="" className="w-[55%]" sizes="60px" />
                </div>

                <h3 className="text-lead leading-tightest text-ink mt-10 font-medium">
                  {card.name}
                </h3>
                <p className="text-body text-grey-500 mt-3 leading-relaxed">{card.body}</p>

                <p className="text-micro mt-8 tracking-[0.08em] text-white/75">
                  {ingredients.label}
                </p>

                <ul className="mt-2 space-y-2">
                  {card.chips.map((chip) => (
                    <li key={chip} className="text-body text-grey-500 flex items-center gap-2.5">
                      <Check
                        aria-hidden="true"
                        strokeWidth={2.5}
                        className="border-brand-cyan text-brand-cyan size-6 shrink-0 rounded-full border p-0.5"
                      />
                      {chip}
                    </li>
                  ))}
                </ul>
              </article>
            </li>
          ))}
        </ul>

        <ul className="mt-6 grid gap-4 rounded-[1.25rem] border border-black/10 bg-white/60 px-6 py-6 sm:grid-cols-2 lg:flex lg:items-center lg:justify-between lg:px-10">
          {ingredients.trustBadges.map((badge) => {
            const Icon = TRUST_ICONS[badge.icon]
            return (
              <li key={badge.label} className="text-body text-grey-500 flex items-center gap-2.5">
                <Icon aria-hidden="true" className="text-success size-6 shrink-0" />
                {badge.label}
              </li>
            )
          })}
        </ul>
      </Container>

      {/* Same soft hand-over as the band above, mirrored so the two curves are not identical,
          carrying the testimonial band's cyan. */}
      <SoftWave fillClassName="fill-brand-cyan-mid" flip className="absolute inset-x-0 bottom-0" />
    </Section>
  )
}
