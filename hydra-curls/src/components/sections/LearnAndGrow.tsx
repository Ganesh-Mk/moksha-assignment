import { ArrowRight } from 'lucide-react'

import { Container } from '@/components/layout/Container'
import { Eyebrow } from '@/components/primitives/Eyebrow'
import { Picture } from '@/components/primitives/Picture'
import { SectionHeading } from '@/components/primitives/SectionHeading'
import { SoftWave } from '@/components/primitives/SoftWave'
import { WavyPanelEdge } from '@/components/primitives/WavyPanelEdge'
import { learn } from '@/content/sections'
import { cn } from '@/lib/utils'

/**
 * y11849–14208. The tallest block on the page: three full-bleed rows, each a 960px photograph
 * beside a 976px colour panel, alternating sides and cycling through periwinkle, purple, teal.
 *
 * The panel is 16px wider than half the frame and starts 16px early, so it laps over the
 * photograph rather than butting against it — reproduced with a small negative margin at `lg`
 * instead of a seam.
 *
 * Below `lg` the rows stack, image over panel, and the overlap is dropped: a 16px lap reads as
 * a rendering mistake once the two are no longer side by side.
 */
export function LearnAndGrow() {
  return (
    <section id="learn" aria-labelledby="learn-heading" className="bg-page relative w-full">
      {/* The hair-type band above ends on a row of shallow scallops in the reference, not a
          straight edge. The wave carries this section's colour up over that one. */}
      <SoftWave
        fillClassName="fill-page"
        shape="bumpy"
        className="absolute inset-x-0 top-0 h-[clamp(2rem,4.5vw,5rem)] -translate-y-full"
      />

      <Container className="py-14 md:py-20">
        <Eyebrow>{learn.eyebrow}</Eyebrow>
        <SectionHeading id="learn-heading" lines={learn.heading} className="mt-6 text-center" />
        <p className="font-script text-lead leading-script text-grey-500 mx-auto mt-6 max-w-[45.125rem] text-center">
          {learn.lead}
        </p>
      </Container>

      <ul>
        {learn.items.map((item, index) => (
          <li
            key={index}
            data-reveal=""
            // `overflow-hidden` so the seam cannot spill past the row into the band below.
            className={cn(
              'grid overflow-hidden lg:grid-cols-2',
              // The panel is the second cell in the DOM either way, so the image side is
              // switched by reordering at `lg` rather than by duplicating the markup.
              item.imageSide === 'right' && 'lg:[&>*:first-child]:order-2',
            )}
          >
            <Picture
              asset={item.image}
              className="aspect-[960/632] w-full"
              imgClassName="h-full w-full object-cover"
              sizes="(min-width: 1024px) 50vw, 100vw"
            />

            <div
              className={cn(
                'relative flex flex-col justify-center px-6 py-12 md:px-12 lg:py-16',
                'lg:z-10 xl:px-[7.5rem]',
                item.panelClassName,
              )}
            >
              {/* The seam between photograph and panel ripples in the design. Dropped below
                  `lg`, where the two stack and a vertical wave would run across the join rather
                  than along it.

                  The panels used to lap the photo with a 16px negative margin, alternating side
                  with the layout — which put the seam at 50% − 16px on one row and 50% + 16px on
                  the next, so consecutive rows visibly disagreed about where the join was. The
                  margin is gone: every row now meets at the grid's own midpoint and the ripple
                  itself provides the overlap. */}
              <WavyPanelEdge
                side={item.imageSide === 'left' ? 'left' : 'right'}
                fillClassName={item.edgeFillClassName}
              />
              <Eyebrow tone="light" align="left" className="text-left">
                {item.eyebrow}
              </Eyebrow>
              <h3 className="text-lead leading-tightest mt-8 text-white">{item.title}</h3>
              {/* Figma sets this at #DBDBDB, which drops to 2.4:1 on the teal panel. White is the
                  smallest change that clears the bar on all three panel colours. */}
              <p className="mt-3 max-w-[30.8125rem] text-xs leading-normal text-white">
                {item.body}
              </p>
              <a
                href="#products"
                // Same sweeping underline and travelling arrow as BrandButton's `link`
                // variant, in white for the coloured panels.
                className={cn(
                  'text-body relative mt-8 inline-flex min-h-11 w-fit items-center gap-3 text-white',
                  'after:absolute after:inset-x-0 after:bottom-2 after:h-px after:origin-left after:bg-current',
                  'after:scale-x-0 after:transition-transform after:duration-300 hover:after:scale-x-100',
                  '[&_svg]:transition-transform [&_svg]:duration-300 hover:[&_svg]:translate-x-1.5',
                  'motion-reduce:hover:[&_svg]:translate-x-0',
                )}
              >
                {item.cta}
                <ArrowRight aria-hidden="true" className="size-6" />
              </a>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
