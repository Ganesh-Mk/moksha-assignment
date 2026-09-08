import { ChevronLeft, ChevronRight, Star } from 'lucide-react'

import { Eyebrow } from '@/components/primitives/Eyebrow'
import { Picture } from '@/components/primitives/Picture'
import { SectionHeading } from '@/components/primitives/SectionHeading'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel'
import { CurvedText } from '@/components/primitives/CurvedText'
import { SoftWave } from '@/components/primitives/SoftWave'
import { decorativeArcText, testimonials } from '@/content/sections'
import { cn } from '@/lib/utils'

/**
 * The two quote controls. White discs on the cyan band, filling with the deep navy of the cards
 * they scroll — so the button previews the surface it moves you through rather than just
 * inverting. No shadow: they sit on a flat colour field where one would only smudge the edge.
 */
const quoteNavClass = cn(
  'text-ink static size-14 translate-y-0 border-none bg-white md:size-[4.875rem]',
  'transition-[background-color,color,transform] duration-300 ease-out',
  'hover:bg-ink hover:text-white hover:scale-105 motion-reduce:hover:scale-100',
  'disabled:opacity-40',
  '[&_svg]:size-5 md:[&_svg]:size-6',
)

/**
 * y7748–8857. Model photograph left, quotes right, on a solid #77DBFC band.
 *
 * The heading's highlighted run is **white** here rather than cyan — it already sits on cyan,
 * so the usual accent would vanish. That is why SectionHeading takes the accent as a prop
 * instead of hard-coding the brand colour.
 *
 * The photograph is a before/after composite: one image with the seam already in it, plus the
 * divider rule and the pink handle drawn on top. There is no second image to reveal, so the
 * handle is presentational and marked as such rather than being a control that does nothing.
 *
 * The two circular buttons are wired to a vertical carousel over the quotes. With two quotes
 * and two visible they end up disabled, which is the honest state — a control that says there
 * is nothing further, rather than a button that silently does nothing.
 */
export function Testimonials() {
  return (
    <section
      aria-labelledby="testimonials-heading"
      className="bg-brand-cyan-mid relative w-full overflow-hidden py-16 md:py-20"
    >
      <CurvedText
        id="testimonials-watermark"
        chord={700}
        sag={-520}
        fontSize={26}
        fontClassName="font-curved"
        className="pointer-events-none absolute -top-[2%] right-[1%] hidden w-[22%] text-white/40 lg:block"
      >
        {decorativeArcText}
      </CurvedText>

      {/* The faint loops drifting through the band. In the reference these are large, very
          low-contrast rings — closer to a watermark than a pattern — and without them the cyan
          reads as a flat slab of colour. Thin strokes rather than filled shapes, so they cost
          nothing and cannot compete with the quotes on top of them. */}
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        className="pointer-events-none absolute inset-0 h-full w-full text-white/25"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="1180" cy="180" r="120" />
        <circle cx="1320" cy="330" r="180" />
        <circle cx="1010" cy="560" r="150" />
        <circle cx="1290" cy="700" r="110" />
        <circle cx="1130" cy="820" r="90" />
      </svg>

      {/* The photograph runs flush to the viewport edge (Figma places it at x0, 1091 wide),
          so the grid sits on the section rather than inside the content container and only the
          copy column carries the gutter. */}
      <div className="relative grid items-center gap-12 lg:grid-cols-[56.8%_1fr] lg:gap-0">
        <div className="relative">
          {/* The source is a 1024x1536 portrait; Figma's node is 1091x993, so the design crops
              it hard to landscape and anchors the face at the top. Rendering it at its natural
              aspect makes this band roughly twice as tall as designed. The clipped corner
              matches the diagonal Figma cuts across the bottom edge. */}
          <Picture
            asset="testimonial-model"
            alt="Customer before and after using Hydra Curls"
            className="aspect-[1091/993] w-full [clip-path:polygon(0_0,100%_0,100%_93%,0_100%)]"
            imgClassName="h-full w-full object-cover object-top"
            sizes="(min-width: 1024px) 57vw, 100vw"
          />
          {/* The comparison seam. Presentational: the "before" and "after" are already
              composited into the single exported image. */}
          <div aria-hidden="true" className="absolute inset-y-0 left-1/2 w-px bg-white/80" />
          <div
            aria-hidden="true"
            className="bg-pastel-blush/95 absolute top-1/2 left-1/2 flex size-[3.5rem] -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-0.5 rounded-full md:size-[5.75rem]"
          >
            <ChevronLeft className="size-5 text-white" />
            <ChevronRight className="size-5 text-white" />
          </div>
        </div>

        <div className="xl:pr-gutter px-5 md:px-10 lg:pr-24">
          <Eyebrow tone="light" align="left" className="text-left">
            {testimonials.eyebrow}
          </Eyebrow>
          <SectionHeading
            id="testimonials-heading"
            lines={testimonials.heading}
            accent="white"
            className="mt-6"
          />

          {/* Looping, so neither button ever dead-ends. The design ships one quote placed
              twice; with five the control has somewhere to go — see the note in
              src/content/sections.ts. */}
          <Carousel
            orientation="vertical"
            opts={{ align: 'start', loop: true, duration: 32 }}
            className="mt-10"
          >
            {/* Cards size to their own copy and the viewport is a fixed window over them, rather
                than the slots being forced to an even fraction of it.
                `basis-1/2` had to guess a slot height, and the quotes are not all one height —
                they run 314px at 1440 and 393px at 1024 — so whatever number was chosen clipped
                the second card at some width. A window plus a fade shows two whole cards and a
                deliberate sliver of the third, which also tells you there is more to scroll. */}
            <CarouselContent className="-mt-4 h-[41rem] md:h-[37rem] lg:h-[52rem] xl:h-[45rem] 2xl:h-[41rem]">
              {testimonials.items.map((item, index) => (
                <CarouselItem key={index} className="basis-auto pt-4">
                  <figure className="border-brand-cyan-dark/45 bg-ink rounded-[1.25rem] border p-6 md:p-8">
                    {/* aria-label is prohibited on a plain <div>, and adding role="img" purely
                        to carry one trades an accessibility violation for a lint one. The
                        rating is stated as text and the stars are marked decorative. */}
                    <p className="sr-only">{`${item.rating} out of 5 stars`}</p>
                    <div aria-hidden="true" className="flex gap-1">
                      {Array.from({ length: item.rating }, (_, star) => (
                        <Star key={star} className="fill-star text-star size-5" />
                      ))}
                    </div>
                    <blockquote className="text-body text-grey-300 mt-5 leading-relaxed">
                      {item.quote}
                    </blockquote>
                    <figcaption className="mt-8 flex items-center gap-3">
                      <Picture
                        asset={item.avatar}
                        alt=""
                        className="size-14 shrink-0 overflow-hidden rounded-full"
                        imgClassName="h-full w-full object-cover"
                        sizes="56px"
                      />
                      <span>
                        <span className="text-body block text-white">{item.name}</span>
                        <span className="text-grey-300 block text-xs font-light">
                          {item.location}
                        </span>
                      </span>
                    </figcaption>
                  </figure>
                </CarouselItem>
              ))}
            </CarouselContent>

            {/* Fades the clipped card into the band so the cut reads as a peek rather than as
                a rendering fault. Sits above the track and takes no pointer events. */}
            <div
              aria-hidden="true"
              className="from-brand-cyan-mid pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t to-transparent"
            />

            <div className="mt-6 flex justify-end gap-3 lg:absolute lg:top-1/2 lg:-right-24 lg:mt-0 lg:flex-col lg:justify-start">
              <CarouselPrevious className={quoteNavClass} />
              <CarouselNext className={quoteNavClass} />
            </div>
          </Carousel>
        </div>
      </div>

      {/* The band hands over to the experts grid on one long sweep, high at the left where the
          photograph's own diagonal cut ends. */}
      <SoftWave
        fillClassName="fill-page"
        shape="swoop"
        className="absolute inset-x-0 bottom-0 h-[clamp(2.5rem,6vw,7rem)]"
      />
    </section>
  )
}
