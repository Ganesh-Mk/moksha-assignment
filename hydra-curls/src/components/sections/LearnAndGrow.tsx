import { ArrowRight } from 'lucide-react'

import { Container } from '@/components/layout/Container'
import { Eyebrow } from '@/components/primitives/Eyebrow'
import { Picture } from '@/components/primitives/Picture'
import { SectionHeading } from '@/components/primitives/SectionHeading'
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
    <section id="learn" aria-labelledby="learn-heading" className="bg-page w-full">
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
            className={cn(
              'grid lg:grid-cols-2',
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
                'flex flex-col justify-center px-6 py-12 md:px-12 lg:py-16',
                'lg:z-10 xl:px-[7.5rem]',
                item.imageSide === 'left' ? 'lg:-ml-4' : 'lg:-mr-4',
                item.panelClassName,
              )}
            >
              <Eyebrow tone="light" align="left" className="text-left">
                {item.eyebrow}
              </Eyebrow>
              <h3 className="text-lead leading-tightest mt-8 text-white">{item.title}</h3>
              <p className="text-grey-250 mt-3 max-w-[30.8125rem] text-xs leading-normal">
                {item.body}
              </p>
              <a
                href="#products"
                className="text-body mt-8 inline-flex min-h-11 w-fit items-center gap-3 text-white underline-offset-4 hover:underline"
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
