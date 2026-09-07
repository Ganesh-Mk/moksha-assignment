import { ArrowRight, CircleCheck, Droplet, Sparkles } from 'lucide-react'

import { Container } from '@/components/layout/Container'
import { BrandButton } from '@/components/primitives/BrandButton'
import { Eyebrow } from '@/components/primitives/Eyebrow'
import { FeatureBadge } from '@/components/primitives/FeatureBadge'
import { Picture } from '@/components/primitives/Picture'
import { RichParagraph } from '@/components/primitives/RichParagraph'
import { newLaunch } from '@/content/sections'
import { site } from '@/content/site'

/**
 * Figma uses `charm:circle-tick`, `ic:outline-water-drop` and `boxicons:sparkles` — icon-set
 * references rather than drawn paths. Matched to their lucide equivalents, which is the icon
 * set shadcn already pulls in, so no fourth icon dependency.
 */
const BADGE_ICONS = [CircleCheck, Droplet, Sparkles]

/**
 * y1199–2029. Copy on the left at the 120px grid margin, product photography on the right.
 *
 * The artwork is decorative and deliberately oversized — the palm leaf is an 873px square
 * anchored off the top-right corner and the water splash is 628px, both bleeding past the band
 * edge. They live in an `overflow-hidden` wrapper and are hidden below `lg`, where there is no
 * room for them beside the copy and they would otherwise force a horizontal scrollbar.
 */
export function NewLaunch() {
  return (
    <section
      id="new-launch"
      aria-labelledby="new-launch-heading"
      className="bg-page relative w-full overflow-hidden py-14 md:py-20 xl:py-24"
    >
      {/* Decorative art. Positioned as a percentage of the band so it keeps its relationship
          to the copy as the viewport narrows, rather than sliding across it. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden lg:block">
        <Picture
          asset="palm-leaf"
          alt=""
          className="absolute -top-[7%] left-[60%] w-[45%]"
          sizes="45vw"
        />
        <Picture
          asset="water-splash"
          alt=""
          className="absolute top-[14%] left-[49%] w-[33%]"
          sizes="33vw"
        />
      </div>

      <Container className="relative grid items-center gap-10 lg:grid-cols-[minmax(0,41.4%)_1fr] lg:gap-0">
        <div>
          <Eyebrow align="left" className="text-left">
            {newLaunch.eyebrow}
          </Eyebrow>

          <Picture
            asset="logo-lockup"
            alt={`${site.brand} ${site.product}`}
            className="mt-6 w-[10.5rem]"
            sizes="168px"
          />

          {/* The heading of record for this band. Visually the lockup above plays that role,
              so the text is available to assistive tech and search engines without being
              painted twice. */}
          <h2 id="new-launch-heading" className="sr-only">
            {site.product}
          </h2>

          <RichParagraph
            runs={newLaunch.intro}
            className="font-script text-lead leading-script text-grey-500 mt-9 max-w-[43.5rem]"
          />

          <ul className="mt-7 flex flex-wrap gap-3">
            {newLaunch.badges.map((badge, index) => {
              const Icon = BADGE_ICONS[index] ?? CircleCheck
              return (
                <FeatureBadge key={badge.label} icon={Icon}>
                  {badge.label}
                </FeatureBadge>
              )
            })}
          </ul>

          <div className="mt-8 flex flex-wrap gap-4">
            <BrandButton href="#products">
              {newLaunch.primaryCta}
              <ArrowRight aria-hidden="true" className="size-6" />
            </BrandButton>
            <BrandButton href="#learn" variant="outline">
              {newLaunch.secondaryCta}
            </BrandButton>
          </div>
        </div>

        {/* The bottle is content, not decoration — it is the product this band announces — so
            it keeps its alt text and stays visible at every width.
            At `lg` it sits where Figma puts it: x1052 of 1920, 474 wide, which inside this
            column is a 21.2% offset at half the column width. Below `lg` the artwork behind it
            is hidden, so it simply centres. */}
        <div className="relative flex justify-center lg:block">
          <Picture
            asset="bottle-shampoo-hero"
            // Figma rotates this node by 0.34rad (≈19.5°); the bottle is deliberately tilted
            // into the splash rather than standing upright.
            className="w-[15rem] max-w-full rotate-[19.5deg] sm:w-[22rem] lg:ml-[21.2%] lg:w-1/2"
            sizes="(min-width: 1024px) 474px, 288px"
          />
        </div>
      </Container>
    </section>
  )
}
