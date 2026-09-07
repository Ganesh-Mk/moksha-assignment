import { useCallback, useEffect, useState } from 'react'

import { CurvedText } from '@/components/primitives/CurvedText'
import { Picture } from '@/components/primitives/Picture'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from '@/components/ui/carousel'
import { curvedArcText, products } from '@/content/sections'
import { cn } from '@/lib/utils'

/**
 * y4365–5467. The product carousel, sitting on a purple disc.
 *
 * The purple shape is the **bottom** of a circle, not a band and not a dome. Figma draws three
 * concentric 2052px circles in brand purple at 100%, 38% and 20% opacity, centred on the page
 * axis; their crown is hidden behind the benefit cards above, so only the underside shows. The
 * two translucent ones are offset 46px and 91px lower, which is what produces the pale rims
 * that peek out beneath the solid edge.
 *
 * The 48-glyph script arc sits *below* that curve, on the page background, echoing it — which
 * is why the two are built together rather than as separate bands.
 *
 * A note on Phase 1's "no animations" rule: the sliding here is the control's function, not
 * decoration. The design ships prev/next buttons, five thumbnail selectors and a name that
 * tracks the active slide, so a static rendering would be a broken control rather than a
 * faithful one. No entrance or reveal motion has been added.
 */
export function ProductShowcase() {
  const [api, setApi] = useState<CarouselApi>()
  const [active, setActive] = useState(0)

  useEffect(() => {
    if (!api) return
    const sync = () => setActive(api.selectedScrollSnap())
    sync()
    api.on('select', sync)
    return () => {
      api.off('select', sync)
    }
  }, [api])

  const scrollTo = useCallback((index: number) => api?.scrollTo(index), [api])
  const activeProduct = products[active] ?? products[0]

  return (
    <section
      id="products"
      aria-labelledby="products-heading"
      className="bg-page relative w-full overflow-hidden pb-6"
    >
      <h2 id="products-heading" className="sr-only">
        The Hydra Curls range
      </h2>

      {/* The three circles. 2052px across against a 1920px frame, bottom-anchored so the
          section clips everything above — the underside of the circle is the whole shape.
          The translucent pair sits 46px and 91px lower (2.24% and 4.44% of the diameter),
          which is what leaves the pale rims visible beneath the solid edge. */}
      <div className="relative">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-1/2 aspect-square w-[107%] -translate-x-1/2"
        >
          <div className="bg-brand-purple/20 absolute inset-0 translate-y-[4.44%] rounded-full" />
          <div className="bg-brand-purple/38 absolute inset-0 translate-y-[2.24%] rounded-full" />
          <div className="bg-brand-purple absolute inset-0 rounded-full" />
        </div>

        <div className="relative z-10 px-5 pt-10 pb-[4.4%] md:pt-16">
          <Carousel
            setApi={setApi}
            opts={{ align: 'center', loop: true }}
            className="mx-auto w-full max-w-[71.875rem]"
          >
            <CarouselContent className="items-end">
              {products.map((product, index) => (
                <CarouselItem key={product.name} className="basis-full sm:basis-1/2 md:basis-1/3">
                  {/* Figma's carousel viewport is 1150x572 — height-constrained, not
                      width-constrained. Sizing by width instead lets the tall shampoo bottle
                      drive the whole band and stretches the purple well past its designed
                      depth, so the slide fixes a height and the bottles fit inside it. */}
                  <div className="relative flex h-[52vw] max-h-[35.75rem] items-end justify-center sm:h-[34vw]">
                    {/* The soft halo behind the active bottle. Sized from the slide so it
                      tracks whatever the carousel is showing. */}
                    <div
                      aria-hidden="true"
                      className={cn(
                        'absolute top-[8%] bottom-[8%] left-1/2 w-[78%] -translate-x-1/2 rounded-[50%] blur-2xl transition-opacity duration-300',
                        index === active
                          ? 'bg-pastel-pink/70 opacity-100'
                          : 'bg-white/25 opacity-70',
                      )}
                    />
                    <Picture
                      asset={product.image}
                      className={cn(
                        'relative h-full origin-bottom transition-transform duration-300',
                        index === active ? 'scale-100' : 'scale-[0.62]',
                      )}
                      imgClassName="h-full w-auto object-contain"
                      sizes="(min-width: 768px) 25vw, 45vw"
                    />
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>

            <CarouselPrevious className="left-1 size-11 rounded-[1.25rem] border-white/50 bg-white/30 text-white hover:bg-white/45 hover:text-white sm:left-0 sm:size-[3.25rem] md:size-[4.6875rem]" />
            <CarouselNext className="right-1 size-11 rounded-[1.25rem] border-white/50 bg-white/30 text-white hover:bg-white/45 hover:text-white sm:right-0 sm:size-[3.25rem] md:size-[4.6875rem]" />
          </Carousel>

          <p
            // aria-live so the name is announced when the slide changes; without it a
            // keyboard user hears nothing after pressing the next button.
            aria-live="polite"
            className="text-product mt-8 text-center font-medium text-white"
          >
            {activeProduct?.name}
          </p>

          {/* Thumbnail selectors. Real buttons, so the range is reachable without dragging. */}
          <ul className="mt-8 flex flex-wrap items-center justify-center gap-2 sm:gap-4 md:mt-10">
            {products.map((product, index) => (
              <li key={product.name}>
                <button
                  type="button"
                  onClick={() => scrollTo(index)}
                  aria-label={`Show ${product.name}`}
                  aria-current={index === active ? 'true' : undefined}
                  className={cn(
                    'flex size-11 items-center justify-center rounded-full border transition-colors sm:size-[3.25rem] md:size-[5.3125rem]',
                    index === active
                      ? 'border-brand-cyan bg-transparent'
                      : 'border-transparent bg-white/30 hover:bg-white/45',
                  )}
                >
                  <Picture asset={product.image} alt="" className="w-[55%]" sizes="48px" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* The arc echoes the curve above it: chord 1572, sagging 251 at 72px, measured off the
          bounding boxes of the 48 individual glyph nodes. Pulled up so it tucks under the
          circle's rim the way it does in the design. */}
      <CurvedText
        chord={1572}
        sag={251}
        fontSize={72}
        className="pointer-events-none relative z-0 mx-auto mt-[11%] -mb-[5%] w-[86%] max-w-[98.25rem] text-black/45"
      >
        {curvedArcText}
      </CurvedText>
    </section>
  )
}
