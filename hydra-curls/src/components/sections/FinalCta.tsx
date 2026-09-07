import { ArrowRight } from 'lucide-react'

import { Container } from '@/components/layout/Container'
import { BrandButton } from '@/components/primitives/BrandButton'
import { SectionHeading } from '@/components/primitives/SectionHeading'
import { StatBlock } from '@/components/primitives/StatBlock'
import { finalCta } from '@/content/sections'

/**
 * y14209–14692. Closing call to action on the deep navy band.
 *
 * The stats are a 2x2 grid rather than a row of four — Figma places them at two y positions
 * (14337 and 14506), which a single flex row would flatten.
 */
export function FinalCta() {
  return (
    <section
      aria-labelledby="final-cta-heading"
      className="bg-brand-navy-deep w-full py-14 md:py-20"
    >
      <Container className="grid items-center gap-12 lg:grid-cols-[minmax(0,58%)_1fr]">
        <div>
          {/* 52px here rather than the usual 54 — `text-h2-cta` overrides SectionHeading's
              default now that cn() knows both are font sizes rather than colours. */}
          <SectionHeading
            id="final-cta-heading"
            lines={finalCta.heading}
            className="text-h2-cta text-white"
          />
          <p className="font-script text-lead leading-script mt-6 max-w-[40.5625rem] text-white/75">
            {finalCta.lead}
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            <BrandButton href="#products" variant="pill">
              {finalCta.primaryCta}
              <ArrowRight aria-hidden="true" className="size-6" />
            </BrandButton>
            <BrandButton
              href="#learn"
              variant="outline"
              // The outline variant defaults to the ink cyan for light bands; on this navy
              // band that reads at 3.2:1, so it takes the bright brand cyan back.
              className="border-brand-cyan-dark text-brand-cyan"
            >
              {finalCta.secondaryCta}
            </BrandButton>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-8 gap-y-10">
          {finalCta.stats.map((stat) => (
            <StatBlock key={stat.label} value={stat.value} label={stat.label} />
          ))}
        </dl>
      </Container>
    </section>
  )
}
