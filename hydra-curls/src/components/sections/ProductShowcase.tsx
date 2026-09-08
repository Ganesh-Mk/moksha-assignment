import { useCallback, useEffect, useState } from 'react'

import { CurvedText } from '@/components/primitives/CurvedText'
import { Picture } from '@/components/primitives/Picture'
import { SoftWave } from '@/components/primitives/SoftWave'
import { WaveDivider } from '@/components/primitives/WaveDivider'
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
  // Autoplay pauses while a pointer is over the carousel or focus is inside it, so it never
  // moves the slide out from under someone reading or tabbing through the controls.
  const [engaged, setEngaged] = useState(false)

  useEffect(() => {
    if (!api) return
    const sync = () => setActive(api.selectedScrollSnap())
    sync()
    api.on('select', sync)
    return () => {
      api.off('select', sync)
    }
  }, [api])

  /**
   * Infinite auto-advance, written by hand rather than pulling in embla-carousel-autoplay: the
   * behaviour worth having is four lines of interval plus the pause rules, and a plugin would
   * be another dependency to justify.
   *
   * It stops entirely under reduced motion — an unattended loop is exactly the kind of motion
   * that setting exists to switch off — and while the tab is hidden, where the interval would
   * otherwise queue up advances that all land at once on return.
   */
  useEffect(() => {
    if (!api || engaged) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const id = window.setInterval(() => {
      if (document.hidden) return
      api.scrollNext()
    }, 4200)
    return () => window.clearInterval(id)
  }, [api, engaged])

  const scrollTo = useCallback((index: number) => api?.scrollTo(index), [api])
  const activeProduct = products[active] ?? products[0]

  return (
    <section
      id="products"
      aria-labelledby="products-heading"
      className="bg-page relative w-full overflow-hidden"
    >
      <h2 id="products-heading" className="sr-only">
        The Hydra Curls range
      </h2>

      {/* The approach into the band: cloud art bleeding off the left (Figma y3935, 729x416)
          and then the second cyan wave (`Rectangle 140`, y4273). The wave's underside is
          purple because the circle below is already at full width by the time it meets it. */}
      <div className="relative">
        <Picture
          asset="clouds"
          alt=""
          className="pointer-events-none w-[38%] max-w-[45.5625rem]"
          sizes="38vw"
        />
        <WaveDivider className="-mt-[6%]" belowClassName="fill-brand-purple" />
      </div>

      {/* The three circles. 2052px across against a 1920px frame, bottom-anchored so the
          section clips everything above — the underside of the circle is the whole shape.
          The translucent pair sits 46px and 91px lower (2.24% and 4.44% of the diameter),
          which is what leaves the pale rims visible beneath the solid edge. */}
      {/* `overflow-hidden` here, not just on the section: the circle is taller than this
          wrapper and would otherwise ride up over the wave and clouds above it. Clipping at
          the wrapper gives the flat top edge that meets the wave. */}
      <div className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-1/2 aspect-square w-[107%] -translate-x-1/2"
        >
          <div className="bg-brand-purple/20 absolute inset-0 translate-y-[4.44%] rounded-full" />
          <div className="bg-brand-purple/38 absolute inset-0 translate-y-[2.24%] rounded-full" />
          <div className="bg-brand-purple absolute inset-0 rounded-full" />
        </div>

        <div
          className="relative z-10 px-5 pt-10 pb-[4.4%] md:pt-16"
          onPointerEnter={() => setEngaged(true)}
          onPointerLeave={() => setEngaged(false)}
          onFocusCapture={() => setEngaged(true)}
          onBlurCapture={() => setEngaged(false)}
        >
          {/* The glow behind the centre bottle.
              It used to live inside each slide, where the carousel's own `overflow-hidden`
              sliced the blur into a hard rectangle — visible as a cut edge above the bottle and
              down both sides of the band. Since the carousel is centre-aligned the lit spot
              never moves, so one glow on the section behind it is both correct and cheaper:
              nothing clips it, and it no longer re-blurs on every slide change. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-[6%] bottom-[22%] left-1/2 w-[min(34rem,72%)] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(closest-side,rgb(255_255_255/0.55),rgb(255_255_255/0.16)_58%,transparent)] blur-2xl"
          />

          <Carousel
            setApi={setApi}
            // `duration` is embla's glide length in its own units (default 25). The design's
            // bottles are large objects; at the default they snap, which reads as a jump
            // rather than a transition.
            opts={{ align: 'center', loop: true, duration: 38 }}
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

            {/* Glass discs rather than the flat translucent squares they were: at this size,
                over artwork, a bordered rectangle reads as a placeholder. They lift and fill
                with brand cyan on hover, and sit at 42% so they line up with the bottles
                rather than the caption below them. */}
            <CarouselPrevious
              className={cn(
                'absolute top-[42%] z-20 size-12 -translate-y-1/2 rounded-full md:size-16',
                'border border-white/45 bg-white/15 text-white backdrop-blur-md',
                'transition-[background-color,border-color,transform,opacity] duration-300',
                'hover:border-brand-cyan hover:bg-brand-cyan/85 hover:scale-105 hover:text-white',
                'focus-visible:border-brand-cyan motion-reduce:hover:scale-100',
                '[&_svg]:size-5 md:[&_svg]:size-7',
                'left-2 md:left-6',
              )}
            />
            <CarouselNext
              className={cn(
                'absolute top-[42%] z-20 size-12 -translate-y-1/2 rounded-full md:size-16',
                'border border-white/45 bg-white/15 text-white backdrop-blur-md',
                'transition-[background-color,border-color,transform,opacity] duration-300',
                'hover:border-brand-cyan hover:bg-brand-cyan/85 hover:scale-105 hover:text-white',
                'focus-visible:border-brand-cyan motion-reduce:hover:scale-100',
                '[&_svg]:size-5 md:[&_svg]:size-7',
                'right-2 md:right-6',
              )}
            />
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

      {/* The arc, and the band it sits on.
          The reference render does not put this script on the page background: a pale cyan
          field carries on beneath the purple circle and hands over to white along a curve, with
          the arc crossing that boundary. Rendering the text on flat white lost the shape
          entirely and left the line floating in a gap, which is what it looked like. */}
      {/* The top padding is not decoration. CurvedText renders `overflow-visible`, and the
          glyphs at the ends of a sagging arc sit well above the SVG's own box — measured at
          160px of ink above the element at 1440px wide. Without clearance here the line rides
          up over the thumbnails above it. */}
      <div className="bg-page relative pt-[13%]">
        <SoftWave
          fillClassName="fill-brand-cyan-soft"
          className="absolute inset-x-0 bottom-0 h-[clamp(3rem,8vw,9rem)]"
        />

        {/* Figma's 48 glyph nodes span a 1572 chord sagging 251. Reproduced literally, the
            string only covered 83% of the resulting path, so its ends sat on the shallow part
            of the curve and the line read as almost straight next to the reference. The chord
            is pulled in to 1400 (sag scaled to match) so the text occupies ~92% of the arc and
            bows the way the design does. */}
        <CurvedText
          id="showcase-arc"
          chord={1400}
          sag={240}
          fontSize={72}
          className="pointer-events-none relative z-10 mx-auto w-[86%] max-w-[98.25rem] pb-[7%] text-black/45"
        >
          {curvedArcText}
        </CurvedText>
      </div>
    </section>
  )
}
