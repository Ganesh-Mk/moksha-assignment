import { BenefitCards } from '@/components/sections/BenefitCards'
import { BrandKeyVisual } from '@/components/sections/BrandKeyVisual'
import { DesignedForYou } from '@/components/sections/DesignedForYou'
import { ExpertsSaying } from '@/components/sections/ExpertsSaying'
import { FinalCta } from '@/components/sections/FinalCta'
import { Footer } from '@/components/layout/Footer'
import { Hero } from '@/components/sections/Hero'
import { HydraCurlsPromise } from '@/components/sections/HydraCurlsPromise'
import { ISLANDS } from '@/islands'
import { LearnAndGrow } from '@/components/sections/LearnAndGrow'
import { NewLaunch } from '@/components/sections/NewLaunch'
import { PremiumIngredients } from '@/components/sections/PremiumIngredients'

const { navbar: Navbar, showcase: ProductShowcase, testimonials: Testimonials } = ISLANDS

/**
 * The page, in Figma's y order. Every band is a section component composed from primitives;
 * this file is only the running order.
 *
 * The three `data-island` wrappers mark the components that hydrate in the browser. The build
 * prerenders this whole tree to HTML (scripts/prerender.mjs); on the client only those three
 * are mounted as React roots, and the rest stays as the static markup it already is.
 *
 * The wrapper must contain exactly one island component and nothing else — React hydrates
 * against the container's children, so anything extra inside would not match.
 */
export default function App() {
  return (
    <>
      <div data-island="navbar">
        <Navbar />
      </div>
      <main>
        <Hero />
        <NewLaunch />
        <BrandKeyVisual />
        <BenefitCards />
        <div data-island="showcase">
          <ProductShowcase />
        </div>
        <HydraCurlsPromise />
        <PremiumIngredients />
        <div data-island="testimonials">
          <Testimonials />
        </div>
        <ExpertsSaying />
        <DesignedForYou />
        <LearnAndGrow />
        <FinalCta />
      </main>
      <Footer />
    </>
  )
}
