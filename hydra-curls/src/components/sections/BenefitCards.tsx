import { ArrowRight } from 'lucide-react'

import { BrandButton } from '@/components/primitives/BrandButton'
import { Picture } from '@/components/primitives/Picture'
import { benefitCards, products } from '@/content/sections'
import { cn } from '@/lib/utils'

/**
 * The lineup under the right-hand card, in the order Figma stacks it. Relative widths are
 * taken from the node sizes so the bottles keep their size relationship to one another
 * (the shampoo is 141 wide against the conditioner's 332, and the tubs are 211).
 */
const LINEUP = [
  { asset: products[0]?.image, width: 'w-[20%]' },
  { asset: products[1]?.image, width: 'w-[25%]' },
  { asset: products[2]?.image, width: 'w-[22%]' },
  { asset: products[3]?.image, width: 'w-[21%]' },
  { asset: products[4]?.image, width: 'w-[22%]' },
] as const

/**
 * y3336–4020. Two full-bleed 948px cards with a 24px gutter — 948 + 24 + 948 = 1920, so they
 * span the frame edge to edge rather than sitting inside the content container. Their copy is
 * inset 120px, which is the same grid margin the container uses.
 *
 * The two cards are aligned differently on purpose: the left is copy alone and sits centred,
 * the right pins its copy to the top to leave room for the product lineup beneath it.
 *
 * Figma composes that lineup from five separately positioned, overlapping product nodes whose
 * internal transforms are not in the export. Rebuilt here as a flex row aligned to a common
 * baseline, keeping each product's relative width — it reads the same and, unlike five
 * absolutely positioned images, survives being narrowed.
 */
export function BenefitCards() {
  return (
    <section aria-labelledby="benefits-heading" className="bg-page w-full">
      <h2 id="benefits-heading" className="sr-only">
        Why Hydra Curls works
      </h2>

      <div className="grid gap-6 md:grid-cols-2">
        {benefitCards.map((card, index) => (
          <article
            key={index}
            className={cn(
              'bg-brand-cyan-soft relative isolate flex flex-col overflow-hidden',
              'px-5 py-12 md:px-10 md:py-14 xl:px-[7.5rem] xl:py-14',
              card.showLineup ? 'justify-start' : 'justify-center',
            )}
          >
            {/* The wavy texture sits at 2% opacity in Figma — barely perceptible, and the
                reason these cards do not read as flat blocks of colour. */}
            <Picture
              asset="pattern-waves-grey"
              alt=""
              className="pointer-events-none absolute inset-0 -z-10 h-full w-full opacity-[0.02]"
              imgClassName="h-full w-full object-cover"
              sizes="50vw"
            />

            <h3 className="text-card text-ink">{card.title}</h3>
            <p className="text-lead text-grey-500 mt-6 max-w-[49.25rem] leading-snug">
              {card.body}
            </p>
            <BrandButton href="#products" size="md" className="mt-9 w-fit">
              {card.cta}
              <ArrowRight aria-hidden="true" className="size-6" />
            </BrandButton>

            {card.showLineup && (
              <div className="relative mt-10 flex-1">
                {/* Figma's `Ellipse 48`: a white-to-cyan gradient under a layer blur, which is
                    what lifts the bottles off the flat card. */}
                <div
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-0 -z-10 h-3/4 rounded-[50%] bg-[image:var(--gradient-ellipse)] blur-2xl"
                />
                {/* Negative gap: the bottles overlap in the design rather than standing in a
                    row with air between them. */}
                <ul className="flex items-end justify-center gap-[-1%] -space-x-[2%]">
                  {LINEUP.map((item) =>
                    item.asset ? (
                      <li key={item.asset} className={item.width}>
                        <Picture asset={item.asset} sizes="12vw" />
                      </li>
                    ) : null,
                  )}
                </ul>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  )
}
