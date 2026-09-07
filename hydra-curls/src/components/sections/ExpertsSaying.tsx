import { Container } from '@/components/layout/Container'
import { CurvedText } from '@/components/primitives/CurvedText'
import { Eyebrow } from '@/components/primitives/Eyebrow'
import { Picture } from '@/components/primitives/Picture'
import { SectionHeading } from '@/components/primitives/SectionHeading'
import { decorativeArcText, experts } from '@/content/sections'

/**
 * y8916–10459. Heading over an eight-tile grid of customer clips.
 *
 * There are only four images: Figma lays them left-to-right across the top row and
 * right-to-left across the bottom, so the grid reads as eight without shipping eight assets.
 * That mirroring is content, not styling, so the second row is derived here from the same
 * array rather than being a second list to keep in sync.
 *
 * The tiles are 480x509 and run edge to edge — 4 x 480 = 1920 — so the grid sits outside the
 * content container while the heading stays inside it.
 */
export function ExpertsSaying() {
  const topRow = experts.items
  const bottomRow = [...experts.items].reverse()

  return (
    <section aria-labelledby="experts-heading" className="bg-page relative w-full overflow-hidden">
      <CurvedText
        id="experts-watermark"
        chord={700}
        sag={620}
        fontSize={26}
        fontClassName="font-curved"
        className="text-brand-cyan/60 pointer-events-none absolute top-[2%] left-[3%] hidden w-[20%] lg:block"
      >
        {decorativeArcText}
      </CurvedText>

      <Container className="py-14 md:py-16">
        <Eyebrow>{experts.eyebrow}</Eyebrow>
        <SectionHeading id="experts-heading" lines={experts.heading} className="mt-6 text-center" />
      </Container>

      <ul className="grid grid-cols-2 lg:grid-cols-4">
        {[...topRow, ...bottomRow].map((asset, index) => (
          <li key={`${asset}-${index}`}>
            <Picture
              asset={asset}
              // The tiles are 480x509 in Figma; fixing the ratio keeps the two rows aligned
              // regardless of each photograph's own proportions.
              className="aspect-[480/509] w-full"
              imgClassName="h-full w-full object-cover"
              sizes="(min-width: 1024px) 25vw, 50vw"
            />
          </li>
        ))}
      </ul>
    </section>
  )
}
