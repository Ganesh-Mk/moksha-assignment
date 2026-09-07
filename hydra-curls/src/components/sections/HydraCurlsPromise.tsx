import { Droplet, Sparkles } from 'lucide-react'

import { Container } from '@/components/layout/Container'
import { Section } from '@/components/layout/Section'
import { Eyebrow } from '@/components/primitives/Eyebrow'
import { Picture } from '@/components/primitives/Picture'
import { SectionHeading } from '@/components/primitives/SectionHeading'
import { promise } from '@/content/sections'

/** `ic:outline-water-drop` and `boxicons:sparkles` in Figma, matched to their lucide twins. */
const FEATURE_ICONS = [Droplet, Sparkles]

/**
 * y5800–6573. Copy on the left, the 48-hour stat on the right.
 *
 * Two details that are easy to lose: the vertical rule beside the feature list is a *wavy*
 * cyan line rather than a straight border, and "Hours" is a rotated cyan tag overlapping the
 * numeral rather than a caption beneath it. Both are drawn rather than approximated — a plain
 * `border-l` and a stacked label would read as a different design.
 */
export function HydraCurlsPromise() {
  return (
    <Section aria-labelledby="promise-heading" className="bg-brand-cyan-soft">
      <Container>
        <Eyebrow>{promise.eyebrow}</Eyebrow>
        <SectionHeading id="promise-heading" lines={promise.heading} className="mt-6 text-center" />

        <div className="mt-14 grid items-start gap-12 lg:mt-20 lg:grid-cols-[minmax(0,53%)_1fr] lg:gap-8">
          <div>
            <p className="text-lead text-grey-500 max-w-[53.25rem] leading-loose">{promise.lead}</p>

            <div className="relative mt-12 pl-8">
              {/* Figma's `Line 3`: a 12x343 cyan squiggle, not a straight rule. */}
              <svg
                aria-hidden="true"
                focusable="false"
                viewBox="0 0 12 343"
                preserveAspectRatio="none"
                className="absolute top-0 left-0 h-full w-3"
                fill="none"
              >
                <path
                  d="M6 0c-6 24 6 44 0 68s-6 44 0 68 6 44 0 68-6 44 0 68 6 44 0 71"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="text-brand-cyan"
                />
              </svg>

              <dl className="space-y-10">
                {promise.features.map((feature, index) => {
                  const Icon = FEATURE_ICONS[index] ?? Droplet
                  return (
                    <div key={feature.title}>
                      <dt className="text-lead leading-tightest text-ink flex items-center gap-3">
                        <Icon aria-hidden="true" className="text-brand-cyan size-6 shrink-0" />
                        {feature.title}
                      </dt>
                      <dd className="text-body text-grey-500 mt-3 max-w-[31rem] pl-9 leading-relaxed">
                        {feature.body}
                      </dd>
                    </div>
                  )
                })}
              </dl>
            </div>
          </div>

          {/* The stat. Value and unit are one semantic pair, so they are a description list
              rather than two loose blocks — a screen reader announces "48 hours", not "48". */}
          <div className="relative flex flex-col items-center text-center">
            <div className="relative w-[10.125rem] max-w-full">
              <Picture asset="icon-arc" alt="" className="w-full" sizes="162px" />
              <Picture
                asset="icon-clock"
                alt=""
                className="absolute inset-x-0 top-[3%] mx-auto w-[93%]"
                sizes="150px"
              />
            </div>

            <dl className="relative mt-2">
              <dt className="sr-only">{promise.stat.unit}</dt>
              <dd className="text-stat text-ink font-medium">{promise.stat.value}</dd>
              <p
                aria-hidden="true"
                className="bg-brand-cyan text-body absolute -right-6 bottom-3 -rotate-12 rounded-[0.625rem] px-3 py-1.5 text-white"
              >
                {promise.stat.unit}
              </p>
            </dl>

            <p className="text-body text-grey-500 mt-4 max-w-[19.0625rem] leading-relaxed">
              {promise.stat.caption}
            </p>
          </div>
        </div>
      </Container>

      {/* The hand-drawn arrow linking the copy to the stat. Decorative, and dropped below `lg`
          where the two sit stacked and an arrow pointing right would be nonsense. */}
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 242 203"
        className="pointer-events-none absolute top-[62%] left-[47%] hidden w-[12.625rem] lg:block"
        fill="none"
      >
        <path
          d="M2 2c40 78 120 118 220 122"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-ink/60"
        />
        <path
          d="M205 108l17 16-21 10"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-ink/60"
        />
      </svg>
    </Section>
  )
}
