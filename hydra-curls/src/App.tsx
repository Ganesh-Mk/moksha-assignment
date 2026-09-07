import { Footer } from '@/components/layout/Footer'
import { Navbar } from '@/components/layout/Navbar'
import { BenefitCards } from '@/components/sections/BenefitCards'
import { BrandKeyVisual } from '@/components/sections/BrandKeyVisual'
import { DesignedForYou } from '@/components/sections/DesignedForYou'
import { ExpertsSaying } from '@/components/sections/ExpertsSaying'
import { FinalCta } from '@/components/sections/FinalCta'
import { Hero } from '@/components/sections/Hero'
import { HydraCurlsPromise } from '@/components/sections/HydraCurlsPromise'
import { LearnAndGrow } from '@/components/sections/LearnAndGrow'
import { NewLaunch } from '@/components/sections/NewLaunch'
import { PremiumIngredients } from '@/components/sections/PremiumIngredients'
import { ProductShowcase } from '@/components/sections/ProductShowcase'
import { Testimonials } from '@/components/sections/Testimonials'

/**
 * The page, in Figma's y order. Every band is a section component composed from primitives;
 * this file is only the running order.
 *
 * Nothing here is code-split on purpose. The build prerenders this tree to static HTML
 * (scripts/prerender.mjs), so a lazy boundary would put a placeholder into that HTML and
 * then shift the layout when its chunk arrived — trading script weight for layout shift,
 * which is not a win.
 */
export default function App() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <NewLaunch />
        <BrandKeyVisual />
        <BenefitCards />
        <ProductShowcase />
        <HydraCurlsPromise />
        <PremiumIngredients />
        <Testimonials />
        <ExpertsSaying />
        <DesignedForYou />
        <LearnAndGrow />
        <FinalCta />
      </main>
      <Footer />
    </>
  )
}
